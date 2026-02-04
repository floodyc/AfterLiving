import { FastifyInstance } from 'fastify';
import { prisma } from '@legacyvideo/db';
import { createPlanSchema, updatePlanSchema, validateVerifierThreshold } from '@legacyvideo/shared';
import { authenticate } from '../middleware/auth';
import { requirePlanOwnership } from '../middleware/rbac';
import { auditService } from '../lib/audit';

export async function planRoutes(server: FastifyInstance) {
  // Get all plans for authenticated user
  server.get('/', { preHandler: authenticate }, async (request) => {
    const plans = await prisma.legacyPlan.findMany({
      where: {
        userId: request.user!.id,
      },
      include: {
        _count: {
          select: {
            messages: true,
            verifiers: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      data: plans,
    };
  });

  // Get single plan
  server.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate, requirePlanOwnership('id')] },
    async (request) => {
      const plan = await prisma.legacyPlan.findUnique({
        where: { id: request.params.id },
        include: {
          messages: {
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true,
              _count: {
                select: { recipients: true },
              },
            },
          },
          verifiers: {
            select: {
              id: true,
              email: true,
              name: true,
              status: true,
              invitedAt: true,
              acceptedAt: true,
            },
          },
          _count: {
            select: {
              releaseRequests: true,
            },
          },
        },
      });

      return {
        success: true,
        data: plan,
      };
    }
  );

  // Create plan
  server.post('/', { preHandler: authenticate }, async (request, reply) => {
    const body = createPlanSchema.parse(request.body);

    // Validate threshold
    if (!validateVerifierThreshold(body.approvalThreshold, body.totalVerifiers)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_THRESHOLD',
          message: 'Approval threshold must be between 1 and total verifiers',
        },
      });
    }

    const plan = await prisma.legacyPlan.create({
      data: {
        userId: request.user!.id,
        title: body.title,
        description: body.description,
        approvalThreshold: body.approvalThreshold,
        totalVerifiers: body.totalVerifiers,
        status: 'ACTIVE',
      },
    });

    await auditService.log({
      userId: request.user!.id,
      action: 'PLAN_CREATED',
      entityType: 'LegacyPlan',
      entityId: plan.id,
      metadata: { title: plan.title },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      success: true,
      data: plan,
    });
  });

  // Update plan
  server.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate, requirePlanOwnership('id')] },
    async (request, reply) => {
      const body = updatePlanSchema.parse(request.body);

      // If threshold is being updated, validate it
      if (body.approvalThreshold || body.totalVerifiers) {
        const current = await prisma.legacyPlan.findUnique({
          where: { id: request.params.id },
        });

        const newThreshold = body.approvalThreshold ?? current!.approvalThreshold;
        const newTotal = body.totalVerifiers ?? current!.totalVerifiers;

        if (!validateVerifierThreshold(newThreshold, newTotal)) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_THRESHOLD',
              message: 'Approval threshold must be between 1 and total verifiers',
            },
          });
        }
      }

      const plan = await prisma.legacyPlan.update({
        where: { id: request.params.id },
        data: body,
      });

      await auditService.log({
        userId: request.user!.id,
        action: 'PLAN_UPDATED',
        entityType: 'LegacyPlan',
        entityId: plan.id,
        metadata: body,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return {
        success: true,
        data: plan,
      };
    }
  );

  // Suspend plan
  server.post<{ Params: { id: string } }>(
    '/:id/suspend',
    { preHandler: [authenticate, requirePlanOwnership('id')] },
    async (request) => {
      const plan = await prisma.legacyPlan.update({
        where: { id: request.params.id },
        data: { status: 'SUSPENDED' },
      });

      await auditService.log({
        userId: request.user!.id,
        action: 'PLAN_SUSPENDED',
        entityType: 'LegacyPlan',
        entityId: plan.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return {
        success: true,
        data: plan,
      };
    }
  );

  // Delete plan
  server.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate, requirePlanOwnership('id')] },
    async (request, reply) => {
      const plan = await prisma.legacyPlan.findUnique({
        where: { id: request.params.id },
      });

      if (!plan) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Plan not found',
          },
        });
      }

      await prisma.legacyPlan.delete({
        where: { id: request.params.id },
      });

      await auditService.log({
        userId: request.user!.id,
        action: 'PLAN_DELETED',
        entityType: 'LegacyPlan',
        entityId: plan.id,
        metadata: { title: plan.title },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply.status(204).send();
    }
  );
}

