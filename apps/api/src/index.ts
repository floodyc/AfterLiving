import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './routes/auth';
import { planRoutes } from './routes/plans';
import { messageRoutes } from './routes/messages';
import { verifierRoutes } from './routes/verifiers';
import { releaseRoutes } from './routes/releases';
import { auditRoutes } from './routes/audit';
import { adminRoutes } from './routes/admin';
import { uploadRoutes } from './routes/uploads';
import { errorHandler } from './middleware/error-handler';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
const HOST = process.env.HOST || '0.0.0.0';

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  },
  requestIdLogLabel: 'reqId',
  disableRequestLogging: false,
});

async function start() {
  try {
    // Security plugins
    await server.register(helmet, {
      contentSecurityPolicy: false, // Let frontend handle this
    });

    await server.register(cors, {
      origin: process.env.WEB_URL || 'http://localhost:3000',
      credentials: true,
    });

    await server.register(cookie, {
      secret: process.env.API_SECRET || 'replace-with-secure-secret',
    });

    // Rate limiting
    await server.register(rateLimit, {
      max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
      errorResponseBuilder: () => ({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        },
      }),
    });

    // Routes
    await server.register(authRoutes, { prefix: '/api/auth' });
    await server.register(planRoutes, { prefix: '/api/plans' });
    await server.register(messageRoutes, { prefix: '/api/messages' });
    await server.register(verifierRoutes, { prefix: '/api/verifiers' });
    await server.register(releaseRoutes, { prefix: '/api/releases' });
    await server.register(auditRoutes, { prefix: '/api/audit' });
    await server.register(adminRoutes, { prefix: '/api/admin' });
    await server.register(uploadRoutes, { prefix: '/api/uploads' });

    // Health check
    server.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Error handler
    server.setErrorHandler(errorHandler);

    // Start server
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`🚀 API server listening on ${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
const gracefulShutdown = async () => {
  server.log.info('Received shutdown signal, closing server...');
  await server.close();
  server.log.info('Server closed');
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

start();
