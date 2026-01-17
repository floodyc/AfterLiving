import 'dotenv/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { logger } from './lib/logger';
import { processEmailJob } from './processors/email';
import { processReleaseJob } from './processors/release';
import { processCleanupJob } from './processors/cleanup';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Email worker
const emailWorker = new Worker('email', processEmailJob, {
  connection,
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000, // 10 emails per second max
  },
});

emailWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'email' }, 'Email job completed');
});

emailWorker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, queue: 'email', error: err.message },
    'Email job failed'
  );
});

// Release processing worker
const releaseWorker = new Worker('release-process', processReleaseJob, {
  connection,
  concurrency: 2,
});

releaseWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'release-process' }, 'Release job completed');
});

releaseWorker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, queue: 'release-process', error: err.message },
    'Release job failed'
  );
});

// Cleanup worker
const cleanupWorker = new Worker('cleanup', processCleanupJob, {
  connection,
  concurrency: 1,
});

cleanupWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'cleanup' }, 'Cleanup job completed');
});

cleanupWorker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, queue: 'cleanup', error: err.message },
    'Cleanup job failed'
  );
});

logger.info('🔄 Workers started and listening for jobs...');

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down workers...');
  await Promise.all([
    emailWorker.close(),
    releaseWorker.close(),
    cleanupWorker.close(),
  ]);
  await connection.quit();
  logger.info('Workers shut down gracefully');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
