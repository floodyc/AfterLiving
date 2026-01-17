import 'dotenv/config';
import { Worker } from 'bullmq';
import { logger } from './lib/logger';
import { processEmailJob } from './processors/email';
import { processReleaseJob } from './processors/release';
import { processCleanupJob } from './processors/cleanup';

// Connection options for BullMQ (avoids ioredis version conflicts)
const connectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
  maxRetriesPerRequest: null,
};

// Parse REDIS_URL if provided (overrides host/port)
if (process.env.REDIS_URL) {
  const url = new URL(process.env.REDIS_URL);
  connectionOptions.host = url.hostname;
  connectionOptions.port = url.port ? parseInt(url.port) : 6379;
}

// Email worker
const emailWorker = new Worker('email', processEmailJob, {
  connection: connectionOptions,
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
  connection: connectionOptions,
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
  connection: connectionOptions,
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
  logger.info('Workers shut down gracefully');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
