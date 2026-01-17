import { FastifyInstance } from 'fastify';
import { prisma } from '@legacyvideo/db';
import { authenticate, requireAdmin } from '../middleware/auth';
import { lockUserSchema } from '@legacyvideo/shared';
import { auditService } from '../lib/audit';
import { queueReleaseProcess } from '../lib/queue';

export async function adminRoutes(server: FastifyInstance) {
  // All routes require admin authentication
  server.addHook('preHandler', authenticate);
  server.addHook('preHandler', requireAdmin);

  // Get all users
  server.get('/users', async (request) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        locked: true,
        createdAt: true,
        _count: {
          select: {
            plans: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      data: users,
    };
  });

  // Lock/unlock user
  server.post('/users/lock', async (request, reply) => {
    const body = lockUserSchema.parse(request.body);

    const user = await prisma.user.update({
      where: { id: body.userId },
      data: { locked: body.locked },
    });

    await auditService.log({
      userId: request.user!.id,
      action: body.locked ? 'USER_LOCKED' : 'USER_UNLOCKED',
      entityType: 'User',
      entityId: user.id,
      metadata: { targetEmail: user.email },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: user,
    };
  });

  // Get all release requests
  server.get('/releases', async (request) => {
    const requests = await prisma.releaseRequest.findMany({
      include: {
        plan: {
          select: {
            id: true,
            title: true,
            userId: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        verifier: {
          select: {
            email: true,
            name: true,
          },
        },
        approvals: {
          include: {
            verifier: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    return {
      success: true,
      data: requests,
    };
  });

  // Get specific release request
  server.get<{ Params: { id: string } }>('/releases/:id', async (request, reply) => {
    const releaseRequest = await prisma.releaseRequest.findUnique({
      where: { id: request.params.id },
      include: {
        plan: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
            messages: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
            verifiers: true,
          },
        },
        verifier: true,
        approvals: {
          include: {
            verifier: true,
          },
        },
      },
    });

    if (!releaseRequest) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Release request not found',
        },
      });
    }

    return {
      success: true,
      data: releaseRequest,
    };
  });

  // Admin approve release request
  server.post<{ Params: { id: string } }>('/releases/:id/approve', async (request, reply) => {
    const releaseRequest = await prisma.releaseRequest.findUnique({
      where: { id: request.params.id },
      include: {
        plan: true,
      },
    });

    if (!releaseRequest) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Release request not found',
        },
      });
    }

    if (releaseRequest.status !== 'PENDING') {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'This release request has already been processed',
        },
      });
    }

    // Admin can override and approve
    await prisma.releaseRequest.update({
      where: { id: request.params.id },
      data: {
        status: 'APPROVED',
        processedAt: new Date(),
      },
    });

    await auditService.log({
      userId: request.user!.id,
      action: 'RELEASE_APPROVED',
      entityType: 'ReleaseRequest',
      entityId: releaseRequest.id,
      metadata: {
        adminOverride: true,
        planId: releaseRequest.planId,
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    // Queue release processing
    await queueReleaseProcess({
      releaseRequestId: request.params.id,
      planId: releaseRequest.planId,
    });

    return {
      success: true,
      data: {
        message: 'Release approved and processing started',
      },
    };
  });

  // Admin deny release request
  server.post<{ Params: { id: string } }>('/releases/:id/deny', async (request, reply) => {
    const releaseRequest = await prisma.releaseRequest.findUnique({
      where: { id: request.params.id },
    });

    if (!releaseRequest) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Release request not found',
        },
      });
    }

    if (releaseRequest.status !== 'PENDING') {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'This release request has already been processed',
        },
      });
    }

    await prisma.releaseRequest.update({
      where: { id: request.params.id },
      data: {
        status: 'DENIED',
        processedAt: new Date(),
      },
    });

    await auditService.log({
      userId: request.user!.id,
      action: 'RELEASE_DENIED',
      entityType: 'ReleaseRequest',
      entityId: releaseRequest.id,
      metadata: {
        adminOverride: true,
        planId: releaseRequest.planId,
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: {
        message: 'Release denied',
      },
    };
  });

  // Get system statistics
  server.get('/stats', async () => {
    const [userCount, planCount, messageCount, releaseCount] = await Promise.all([
      prisma.user.count(),
      prisma.legacyPlan.count(),
      prisma.videoMessage.count(),
      prisma.releaseRequest.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      success: true,
      data: {
        users: userCount,
        plans: planCount,
        messages: messageCount,
        pendingReleases: releaseCount,
      },
    };
  });
}
