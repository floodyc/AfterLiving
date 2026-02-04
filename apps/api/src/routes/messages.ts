import { FastifyInstance } from 'fastify';
import { prisma } from '@legacyvideo/db';
import { createMessageSchema } from '@legacyvideo/shared';
import { authenticate } from '../middleware/auth';
import { requireMessageOwnership } from '../middleware/rbac';
import { auditService } from '../lib/audit';
import { s3Service } from '../lib/s3';

export async function messageRoutes(server: FastifyInstance) {
  // Get all messages for a plan
  server.get<{ Querystring: { planId: string } }>(
    '/',
    { preHandler: authenticate },
    async (request) => {
      const { planId } = request.query;

      const messages = await prisma.videoMessage.findMany({
        where: {
          planId,
          plan: {
            userId: request.user!.id,
          },
        },
        include: {
          recipients: {
            select: {
              id: true,
              email: true,
              name: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        success: true,
        data: messages.map(m => ({
          ...m,
          sizeBytes: Number(m.sizeBytes),
        })),
      };
    }
  );

  // Get single message
  server.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate, requireMessageOwnership('id')] },
    async (request) => {
      const message = await prisma.videoMessage.findUnique({
        where: { id: request.params.id },
        include: {
          plan: {
            select: {
              id: true,
              title: true,
              userId: true,
            },
          },
          recipients: true,
          recipientAccess: {
            where: {
              revokedAt: null,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });

      return {
        success: true,
        data: message ? {
          ...message,
          sizeBytes: Number(message.sizeBytes),
        } : null,
      };
    }
  );

  // Create message (without video initially)
  server.post('/', { preHandler: authenticate }, async (request, reply) => {
    const body = createMessageSchema.parse(request.body);

    // Verify plan ownership
    const plan = await prisma.legacyPlan.findFirst({
      where: {
        id: body.planId,
        userId: request.user!.id,
      },
    });

    if (!plan) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this plan',
        },
      });
    }

    // Generate storage key for the video
    const storageKey = s3Service.generateStorageKey(request.user!.id, 'temp');

    // Create message
    const message = await prisma.videoMessage.create({
      data: {
        planId: body.planId,
        title: body.title,
        description: body.description,
        releaseConditions: body.releaseConditions,
        storageKey, // Temporary, will be updated after upload
        encryptedDataKey: '', // Will be set after upload
        contentType: '',
        sizeBytes: 0,
        status: 'DRAFT',
        recipients: {
          create: body.recipientEmails?.map((email) => ({
            email,
            status: 'PENDING',
          })) || [],
        },
      },
      include: {
        recipients: true,
      },
    });

    await auditService.log({
      userId: request.user!.id,
      action: 'MESSAGE_CREATED',
      entityType: 'VideoMessage',
      entityId: message.id,
      metadata: { title: message.title, recipientCount: body.recipientEmails?.length || 0 },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      success: true,
      data: {
        ...message,
        sizeBytes: Number(message.sizeBytes),
      },
    });
  });

  // Revoke message
  server.post<{ Params: { id: string } }>(
    '/:id/revoke',
    { preHandler: [authenticate, requireMessageOwnership('id')] },
    async (request) => {
      const message = await prisma.videoMessage.update({
        where: { id: request.params.id },
        data: { status: 'REVOKED' },
      });

      // Revoke all active recipient access tokens
      await prisma.recipientAccess.updateMany({
        where: {
          messageId: request.params.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      await auditService.log({
        userId: request.user!.id,
        action: 'MESSAGE_REVOKED',
        entityType: 'VideoMessage',
        entityId: message.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return {
        success: true,
        data: {
          ...message,
          sizeBytes: Number(message.sizeBytes),
        },
      };
    }
  );

  // Delete message
  server.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate, requireMessageOwnership('id')] },
    async (request, reply) => {
      const message = await prisma.videoMessage.findUnique({
        where: { id: request.params.id },
      });

      if (!message) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Message not found',
          },
        });
      }

      // Delete from S3 if uploaded
      if (message.status !== 'DRAFT' && message.storageKey) {
        try {
          await s3Service.deleteVideo(message.storageKey);
        } catch (error) {
          // Log but don't fail the request
          server.log.error({ error, storageKey: message.storageKey }, 'Failed to delete video from S3');
        }
      }

      // Delete from database (cascades to recipients and access tokens)
      await prisma.videoMessage.delete({
        where: { id: request.params.id },
      });

      return reply.status(204).send();
    }
  );
}


