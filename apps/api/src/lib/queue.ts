import { Queue } from 'bullmq';

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

export interface EmailJob {
  to: string;
  subject: string;
  html: string;
  metadata?: Record<string, unknown>;
}

export interface ReleaseProcessJob {
  releaseRequestId: string;
  planId: string;
}

export interface CleanupJob {
  type: 'expired_tokens' | 'old_audit_logs';
}

export const emailQueue = new Queue<EmailJob>('email', {
  connection: connectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 86400, // Keep for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 604800, // Keep failures for 7 days
    },
  },
});

export const releaseQueue = new Queue<ReleaseProcessJob>('release-process', {
  connection: connectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export const cleanupQueue = new Queue<CleanupJob>('cleanup', {
  connection: connectionOptions,
  defaultJobOptions: {
    attempts: 2,
  },
});

// Helper functions to add jobs
export async function queueEmail(job: EmailJob) {
  return emailQueue.add('send-email', job);
}

export async function queueReleaseProcess(job: ReleaseProcessJob) {
  return releaseQueue.add('process-release', job);
}

export async function queueCleanup(job: CleanupJob) {
  return cleanupQueue.add('cleanup', job);
}
