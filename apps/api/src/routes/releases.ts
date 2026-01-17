import { FastifyInstance } from 'fastify';
import { prisma } from '@legacyvideo/db';
import { createReleaseRequestSchema, approveReleaseSchema } from '@legacyvideo/shared';
import { authenticate } from '../middleware/auth';
import { auditService } from '../lib/audit';
import { emailService } from '../lib/email';
import { queueReleaseProcess } from '../lib/queue';

export async function releaseRoutes(server: FastifyInstance) {
  // Get release requests for a plan
  server.get<{ Querystring: { planId: string } }>(
    '/',
    { preHandler: authenticate },
    async (request) => {
      const { planId } = request.query;

      const requests = await prisma.releaseRequest.findMany({
        where: {
          planId,
          plan: {
            userId: request.user!.id,
          },
        },
        include: {
          verifier: {
            select: {
              id: true,
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
      });

      return {
        success: true,
        data: requests,
      };
    }
  );

  // Create release request (verifier initiates)
  server.post('/', async (request, reply) => {
    const body = createReleaseRequestSchema.parse(request.body);

    // For this endpoint, we need to identify the verifier
    // In a real implementation, we'd have verifier authentication
    // For now, we'll require email in the request body
    const verifierEmail = (request.body as any).verifierEmail;

    if (!verifierEmail) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VERIFIER_EMAIL_REQUIRED',
          message: 'Verifier email is required',
        },
      });
    }

    // Find verifier
    const verifier = await prisma.verifier.findFirst({
      where: {
        planId: body.planId,
        email: verifierEmail,
        status: 'ACCEPTED',
      },
      include: {
        plan: {
          include: {
            verifiers: {
              where: {
                status: 'ACCEPTED',
              },
            },
          },
        },
      },
    });

    if (!verifier) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'NOT_AUTHORIZED',
          message: 'You are not an authorized verifier for this plan',
        },
      });
    }

    // Check if there's already a pending request
    const existingRequest = await prisma.releaseRequest.findFirst({
      where: {
        planId: body.planId,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'REQUEST_EXISTS',
          message: 'There is already a pending release request for this plan',
        },
      });
    }

    // Create release request
    const releaseRequest = await prisma.releaseRequest.create({
      data: {
        planId: body.planId,
        verifierId: verifier.id,
        note: body.note,
        status: 'PENDING',
      },
    });

    // Automatically add approval from requesting verifier
    await prisma.releaseApproval.create({
      data: {
        requestId: releaseRequest.id,
        verifierId: verifier.id,
        approved: true,
        note: 'Initiated request',
      },
    });

    // Notify other verifiers
    const otherVerifiers = verifier.plan.verifiers.filter(
      (v) => v.id !== verifier.id
    );

    for (const v of otherVerifiers) {
      await emailService.notifyVerifierOfRequest(
        v.email,
        verifier.plan.title,
        body.note || ''
      );
    }

    // Notify admin
    await emailService.notifyAdminOfRequest(
      releaseRequest.id,
      verifier.plan.title,
      verifier.email
    );

    await auditService.log({
      action: 'RELEASE_REQUESTED',
      entityType: 'ReleaseRequest',
      entityId: releaseRequest.id,
      metadata: {
        planId: body.planId,
        verifierId: verifier.id,
        verifierEmail: verifier.email,
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      success: true,
      data: releaseRequest,
    });
  });

  // Approve/deny release request
  server.post('/approve', async (request, reply) => {
    const body = approveReleaseSchema.parse(request.body);

    // For this endpoint, we need to identify the verifier
    const verifierEmail = (request.body as any).verifierEmail;

    if (!verifierEmail) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VERIFIER_EMAIL_REQUIRED',
          message: 'Verifier email is required',
        },
      });
    }

    const releaseRequest = await prisma.releaseRequest.findUnique({
      where: { id: body.requestId },
      include: {
        plan: {
          include: {
            verifiers: {
              where: {
                status: 'ACCEPTED',
              },
            },
          },
        },
        approvals: true,
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

    // Find verifier
    const verifier = releaseRequest.plan.verifiers.find(
      (v) => v.email === verifierEmail
    );

    if (!verifier) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'NOT_AUTHORIZED',
          message: 'You are not an authorized verifier for this plan',
        },
      });
    }

    // Check if verifier already approved/denied
    const existingApproval = releaseRequest.approvals.find(
      (a) => a.verifierId === verifier.id
    );

    if (existingApproval) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'ALREADY_RESPONDED',
          message: 'You have already responded to this request',
        },
      });
    }

    // Create approval/denial
    await prisma.releaseApproval.create({
      data: {
        requestId: body.requestId,
        verifierId: verifier.id,
        approved: body.approved,
        note: body.note,
      },
    });

    await auditService.log({
      action: body.approved ? 'RELEASE_APPROVED' : 'RELEASE_DENIED',
      entityType: 'ReleaseRequest',
      entityId: releaseRequest.id,
      metadata: {
        verifierId: verifier.id,
        verifierEmail: verifier.email,
        note: body.note,
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    // Check if we have enough approvals
    const approvals = await prisma.releaseApproval.findMany({
      where: {
        requestId: body.requestId,
        approved: true,
      },
    });

    const denials = await prisma.releaseApproval.findMany({
      where: {
        requestId: body.requestId,
        approved: false,
      },
    });

    // If threshold is met, approve the release
    if (approvals.length >= releaseRequest.plan.approvalThreshold) {
      await prisma.releaseRequest.update({
        where: { id: body.requestId },
        data: {
          status: 'APPROVED',
          processedAt: new Date(),
        },
      });

      // Queue release processing job
      await queueReleaseProcess({
        releaseRequestId: body.requestId,
        planId: releaseRequest.planId,
      });

      return {
        success: true,
        data: {
          status: 'APPROVED',
          message: 'Release request approved. Processing release...',
        },
      };
    }

    // If majority denied, deny the release
    const totalVerifiers = releaseRequest.plan.verifiers.length;
    if (denials.length > totalVerifiers / 2) {
      await prisma.releaseRequest.update({
        where: { id: body.requestId },
        data: {
          status: 'DENIED',
          processedAt: new Date(),
        },
      });

      return {
        success: true,
        data: {
          status: 'DENIED',
          message: 'Release request denied',
        },
      };
    }

    return {
      success: true,
      data: {
        status: 'PENDING',
        message: 'Your response has been recorded. Waiting for more approvals.',
        approvalCount: approvals.length,
        requiredApprovals: releaseRequest.plan.approvalThreshold,
      },
    };
  });
}
