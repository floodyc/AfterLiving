import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

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
  connection,
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
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export const cleanupQueue = new Queue<CleanupJob>('cleanup', {
  connection,
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
