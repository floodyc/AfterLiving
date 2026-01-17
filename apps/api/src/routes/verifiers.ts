import { FastifyInstance } from 'fastify';
import { prisma } from '@legacyvideo/db';
import { inviteVerifierSchema, acceptVerifierSchema, generateToken } from '@legacyvideo/shared';
import { authenticate } from '../middleware/auth';
import { requirePlanOwnership } from '../middleware/rbac';
import { auditService } from '../lib/audit';
import { emailService } from '../lib/email';

export async function verifierRoutes(server: FastifyInstance) {
  // Get verifiers for a plan
  server.get<{ Querystring: { planId: string } }>(
    '/',
    { preHandler: authenticate },
    async (request) => {
      const { planId } = request.query;

      const verifiers = await prisma.verifier.findMany({
        where: {
          planId,
          plan: {
            userId: request.user!.id,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        success: true,
        data: verifiers,
      };
    }
  );

  // Invite verifier
  server.post('/', { preHandler: authenticate }, async (request, reply) => {
    const body = inviteVerifierSchema.parse(request.body);

    // Verify plan ownership
    const plan = await prisma.legacyPlan.findFirst({
      where: {
        id: body.planId,
        userId: request.user!.id,
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
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

    // Check if verifier already exists
    const existing = await prisma.verifier.findUnique({
      where: {
        planId_email: {
          planId: body.planId,
          email: body.email,
        },
      },
    });

    if (existing) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VERIFIER_EXISTS',
          message: 'This person is already a verifier for this plan',
        },
      });
    }

    // Check if we've reached the limit
    const verifierCount = await prisma.verifier.count({
      where: {
        planId: body.planId,
        status: { in: ['INVITED', 'ACCEPTED'] },
      },
    });

    if (verifierCount >= plan.totalVerifiers) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VERIFIER_LIMIT_REACHED',
          message: 'Maximum number of verifiers reached for this plan',
        },
      });
    }

    // Create verifier invitation
    const token = generateToken();
    const verifier = await prisma.verifier.create({
      data: {
        planId: body.planId,
        email: body.email,
        name: body.name,
        token,
        status: 'INVITED',
      },
    });

    // Send invitation email
    await emailService.sendVerifierInvitation(
      body.email,
      plan.title,
      request.user!.email,
      token
    );

    await auditService.log({
      userId: request.user!.id,
      action: 'VERIFIER_INVITED',
      entityType: 'Verifier',
      entityId: verifier.id,
      metadata: { email: body.email, planId: body.planId },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      success: true,
      data: verifier,
    });
  });

  // Accept verifier invitation
  server.post('/accept', async (request, reply) => {
    const body = acceptVerifierSchema.parse(request.body);

    const verifier = await prisma.verifier.findUnique({
      where: { token: body.token },
      include: {
        plan: true,
      },
    });

    if (!verifier) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired invitation token',
        },
      });
    }

    if (verifier.status !== 'INVITED') {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'ALREADY_RESPONDED',
          message: 'You have already responded to this invitation',
        },
      });
    }

    // Check if invitation is expired (7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (verifier.invitedAt < sevenDaysAgo) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVITATION_EXPIRED',
          message: 'This invitation has expired',
        },
      });
    }

    const updated = await prisma.verifier.update({
      where: { id: verifier.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    await auditService.log({
      action: 'VERIFIER_ACCEPTED',
      entityType: 'Verifier',
      entityId: updated.id,
      metadata: { planId: verifier.planId },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: updated,
    };
  });

  // Decline verifier invitation
  server.post('/decline', async (request, reply) => {
    const body = acceptVerifierSchema.parse(request.body);

    const verifier = await prisma.verifier.findUnique({
      where: { token: body.token },
    });

    if (!verifier || verifier.status !== 'INVITED') {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid invitation token',
        },
      });
    }

    const updated = await prisma.verifier.update({
      where: { id: verifier.id },
      data: {
        status: 'DECLINED',
      },
    });

    await auditService.log({
      action: 'VERIFIER_DECLINED',
      entityType: 'Verifier',
      entityId: updated.id,
      metadata: { planId: verifier.planId },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: updated,
    };
  });

  // Revoke verifier
  server.post<{ Params: { id: string } }>(
    '/:id/revoke',
    { preHandler: authenticate },
    async (request, reply) => {
      const verifier = await prisma.verifier.findUnique({
        where: { id: request.params.id },
        include: { plan: true },
      });

      if (!verifier) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Verifier not found',
          },
        });
      }

      // Check ownership
      if (verifier.plan.userId !== request.user!.id && request.user!.role !== 'ADMIN') {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to revoke this verifier',
          },
        });
      }

      const updated = await prisma.verifier.update({
        where: { id: request.params.id },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
        },
      });

      await auditService.log({
        userId: request.user!.id,
        action: 'VERIFIER_REVOKED',
        entityType: 'Verifier',
        entityId: updated.id,
        metadata: { planId: verifier.planId },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return {
        success: true,
        data: updated,
      };
    }
  );
}
