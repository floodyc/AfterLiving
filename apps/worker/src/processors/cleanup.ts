import { Job } from 'bullmq';
import { prisma } from '@legacyvideo/db';
import { logger } from '../lib/logger';

interface CleanupJob {
  type: 'expired_tokens' | 'old_audit_logs';
}

export async function processCleanupJob(job: Job<CleanupJob>) {
  const { type } = job.data;

  logger.info({ jobId: job.id, type }, 'Running cleanup job');

  try {
    if (type === 'expired_tokens') {
      // Delete expired recipient access tokens
      const result = await prisma.recipientAccess.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
          revokedAt: null,
        },
      });

      logger.info({ count: result.count }, 'Expired tokens cleaned up');
      return { success: true, count: result.count };
    }

    if (type === 'old_audit_logs') {
      // Archive audit logs older than 1 year
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const count = await prisma.auditEvent.count({
        where: {
          createdAt: {
            lt: oneYearAgo,
          },
        },
      });

      // In a real system, we'd archive these to cold storage
      // For now, just log the count
      logger.info({ count }, 'Old audit logs that would be archived');
      return { success: true, count };
    }

    return { success: true };
  } catch (error: any) {
    logger.error({ jobId: job.id, error: error.message, type }, 'Cleanup job failed');
    throw error;
  }
}
