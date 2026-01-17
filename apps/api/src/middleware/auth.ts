import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { prisma } from '@legacyvideo/db';
import { SessionUser } from '@legacyvideo/shared';

const JWT_SECRET = process.env.API_SECRET || 'replace-with-secure-secret';

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser;
  }
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

/**
 * Generate JWT token for authenticated user
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'legacyvideo-api',
  });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'legacyvideo-api',
    }) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Authentication middleware - requires valid JWT token
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);

    // Verify user still exists and is not locked
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, locked: true },
    });

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found',
        },
      });
    }

    if (user.locked) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Your account has been locked',
        },
      });
    }

    request.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    });
  }
}

/**
 * Require admin role
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user || request.user.role !== 'ADMIN') {
    return reply.status(403).send({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
      },
    });
  }
}

/**
 * Generate short-lived recipient access token
 */
export function generateRecipientToken(messageId: string, recipientId: string): string {
  return jwt.sign(
    {
      messageId,
      recipientId,
      type: 'recipient_access',
    },
    JWT_SECRET,
    {
      expiresIn: '24h',
      issuer: 'legacyvideo-api',
    }
  );
}

/**
 * Verify recipient access token
 */
export function verifyRecipientToken(token: string): { messageId: string; recipientId: string } {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'legacyvideo-api',
    }) as any;

    if (payload.type !== 'recipient_access') {
      throw new Error('Invalid token type');
    }

    return {
      messageId: payload.messageId,
      recipientId: payload.recipientId,
    };
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
}
