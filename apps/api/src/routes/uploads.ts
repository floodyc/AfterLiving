import { FastifyInstance } from 'fastify';
import { prisma } from '@legacyvideo/db';
import { uploadMetadataSchema, finalizeUploadSchema } from '@legacyvideo/shared';
import { authenticate } from '../middleware/auth';
import { requireMessageOwnership } from '../middleware/rbac';
import { s3Service } from '../lib/s3';
import { encryptionService } from '../lib/encryption';
import { auditService } from '../lib/audit';

export async function uploadRoutes(server: FastifyInstance) {
  // Get presigned upload URL
  server.post<{ Params: { messageId: string } }>(
    '/:messageId/url',
    { preHandler: [authenticate, requireMessageOwnership('messageId')] },
    async (request, reply) => {
      const metadata = uploadMetadataSchema.parse(request.body);

      const message = await prisma.videoMessage.findUnique({
        where: { id: request.params.messageId },
        include: { plan: true },
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

      if (message.status !== 'DRAFT' && message.status !== 'PENDING_UPLOAD') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Message is not in a state that allows upload',
          },
        });
      }

      // Generate new storage key
      const storageKey = s3Service.generateStorageKey(
        message.plan.userId,
        message.id
      );

      // Generate presigned URL for upload
      const uploadUrl = await s3Service.generateUploadUrl(
        storageKey,
        metadata.contentType,
        metadata.sizeBytes
      );

      // Update message with upload metadata
      await prisma.videoMessage.update({
        where: { id: message.id },
        data: {
          storageKey,
          contentType: metadata.contentType,
          sizeBytes: metadata.sizeBytes,
          durationSeconds: metadata.durationSeconds,
          status: 'PENDING_UPLOAD',
        },
      });

      return {
        success: true,
        data: {
          uploadUrl,
          messageId: message.id,
          storageKey,
        },
      };
    }
  );

  // Finalize upload (after client uploads to S3)
  server.post(
    '/finalize',
    { preHandler: authenticate },
    async (request, reply) => {
      const body = finalizeUploadSchema.parse(request.body);

      const message = await prisma.videoMessage.findUnique({
        where: { id: body.messageId },
        include: { plan: true },
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

      // Verify ownership
      if (message.plan.userId !== request.user!.id) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this message',
          },
        });
      }

      if (message.status !== 'PENDING_UPLOAD') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Message is not pending upload',
          },
        });
      }

      // Update message with encrypted data key and mark as uploaded
      const updatedMessage = await prisma.videoMessage.update({
        where: { id: body.messageId },
        data: {
          encryptedDataKey: body.encryptedDataKey,
          status: 'READY',
          uploadedAt: new Date(),
        },
      });

      await auditService.log({
        userId: request.user!.id,
        action: 'MESSAGE_UPLOADED',
        entityType: 'VideoMessage',
        entityId: updatedMessage.id,
        metadata: {
          sizeBytes: updatedMessage.sizeBytes.toString(),
          contentType: updatedMessage.contentType,
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return {
        success: true,
        data: updatedMessage,
      };
    }
  );

  // Get download URL (for testing/admin purposes)
  server.get<{ Params: { messageId: string } }>(
    '/:messageId/download-url',
    { preHandler: [authenticate, requireMessageOwnership('messageId')] },
    async (request, reply) => {
      const message = await prisma.videoMessage.findUnique({
        where: { id: request.params.messageId },
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

      if (message.status !== 'READY' && message.status !== 'RELEASED') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Video is not available for download',
          },
        });
      }

      const downloadUrl = await s3Service.generateDownloadUrl(message.storageKey);

      return {
        success: true,
        data: {
          downloadUrl,
          expiresIn: 86400, // 24 hours
        },
      };
    }
  );
}
