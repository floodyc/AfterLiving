import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@legacyvideo/db';

/**
 * Role-Based Access Control (RBAC) helpers
 */

/**
 * Check if user owns a legacy plan
 */
export async function canAccessPlan(userId: string, planId: string): Promise<boolean> {
  const plan = await prisma.legacyPlan.findFirst({
    where: {
      id: planId,
      userId,
    },
  });

  return !!plan;
}

/**
 * Check if user is a verifier for a plan
 */
export async function isVerifierForPlan(email: string, planId: string): Promise<boolean> {
  const verifier = await prisma.verifier.findFirst({
    where: {
      planId,
      email,
      status: 'ACCEPTED',
    },
  });

  return !!verifier;
}

/**
 * Check if user owns a message
 */
export async function canAccessMessage(userId: string, messageId: string): Promise<boolean> {
  const message = await prisma.videoMessage.findFirst({
    where: {
      id: messageId,
      plan: {
        userId,
      },
    },
  });

  return !!message;
}

/**
 * Middleware to check plan ownership
 */
export function requirePlanOwnership(planIdParam: string = 'planId') {
  return async (request: FastifyRequest<{ Params: Record<string, string> }>, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const planId = request.params[planIdParam];
    if (!planId) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Plan ID required',
        },
      });
    }

    const hasAccess = await canAccessPlan(request.user.id, planId);
    if (!hasAccess && request.user.role !== 'ADMIN') {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this plan',
        },
      });
    }
  };
}

/**
 * Middleware to check message ownership
 */
export function requireMessageOwnership(messageIdParam: string = 'messageId') {
  return async (request: FastifyRequest<{ Params: Record<string, string> }>, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const messageId = request.params[messageIdParam];
    if (!messageId) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Message ID required',
        },
      });
    }

    const hasAccess = await canAccessMessage(request.user.id, messageId);
    if (!hasAccess && request.user.role !== 'ADMIN') {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this message',
        },
      });
    }
  };
}
