import { FastifyInstance } from 'fastify';
import { hash, compare } from 'bcrypt';
import { prisma } from '@legacyvideo/db';
import { loginSchema, registerSchema, magicLinkSchema } from '@legacyvideo/shared';
import { generateToken } from '../middleware/auth';
import { auditService } from '../lib/audit';
import { emailService } from '../lib/email';
import { generateToken as generateRandomToken } from '@legacyvideo/shared';

export async function authRoutes(server: FastifyInstance) {
  // Register
  server.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existing) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists',
        },
      });
    }

    // Create user
    const passwordHash = await hash(body.password, 12);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        role: 'USER',
        emailVerified: false,
      },
    });

    // Create audit event
    await auditService.log({
      userId: user.id,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // TODO: Send verification email in production
    // await emailService.sendVerificationEmail(user.email, generateRandomToken());

    return reply.send({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
        },
      },
    });
  });

  // Login
  server.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user || !user.passwordHash) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Check if account is locked
    if (user.locked) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Your account has been locked. Please contact support.',
        },
      });
    }

    // Verify password
    const isValid = await compare(body.password, user.passwordHash);
    if (!isValid) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Create audit event
    await auditService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return reply.send({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
        },
      },
    });
  });

  // Magic link request
  server.post('/magic-link', async (request, reply) => {
    const body = magicLinkSchema.parse(request.body);

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: body.email,
          role: 'USER',
          emailVerified: true, // Magic link implies email verification
        },
      });
    }

    // Generate magic link token
    const magicToken = generateRandomToken();

    // TODO: Store magic link token with expiry and send email
    // For now, just acknowledge the request
    await emailService.sendMagicLink(body.email, magicToken);

    return reply.send({
      success: true,
      data: {
        message: 'Magic link sent to your email',
      },
    });
  });
}
