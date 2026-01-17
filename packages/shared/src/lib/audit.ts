import { prisma, Prisma, AuditEvent } from '@legacyvideo/db';
import { AUDIT_ACTIONS } from '../constants';

interface AuditContext {
  userId?: string;
  action: keyof typeof AUDIT_ACTIONS;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit Service
 *
 * Creates immutable audit log entries for all sensitive operations.
 * Never update or delete audit events - append-only.
 */
export class AuditService {
  async log(context: AuditContext): Promise<void> {
    try {
      await prisma.auditEvent.create({
        data: {
          userId: context.userId,
          action: context.action,
          entityType: context.entityType,
          entityId: context.entityId,
          metadata: (context.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
    } catch (error) {
      // Critical: audit logging should never fail silently
      throw new Error('Audit logging failed');
    }
  }

  async getEvents(filters: {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditEvent[]> {
    const where: Prisma.AuditEventWhereInput = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    return prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 100,
    });
  }
}

export const auditService = new AuditService();
