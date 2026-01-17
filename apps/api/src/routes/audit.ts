import { FastifyInstance } from 'fastify';
import { authenticate, requireAdmin } from '../middleware/auth';
import { auditService } from '../lib/audit';
import { paginationSchema } from '@legacyvideo/shared';

export async function auditRoutes(server: FastifyInstance) {
  // Get audit events (admin only, or user's own events)
  server.get('/', { preHandler: authenticate }, async (request, reply) => {
    const query = paginationSchema.parse(request.query);

    const filters: any = {};

    // Non-admin users can only see their own audit events
    if (request.user!.role !== 'ADMIN') {
      filters.userId = request.user!.id;
    }

    // Parse additional filters from query
    const queryParams = request.query as any;
    if (queryParams.action) filters.action = queryParams.action;
    if (queryParams.entityType) filters.entityType = queryParams.entityType;
    if (queryParams.entityId) filters.entityId = queryParams.entityId;
    if (queryParams.startDate) filters.startDate = new Date(queryParams.startDate);
    if (queryParams.endDate) filters.endDate = new Date(queryParams.endDate);

    filters.limit = query.limit;

    const events = await auditService.getEvents(filters);

    return {
      success: true,
      data: events,
    };
  });

  // Get specific entity's audit trail (admin only)
  server.get<{
    Params: { entityType: string; entityId: string };
  }>(
    '/:entityType/:entityId',
    { preHandler: [authenticate, requireAdmin] },
    async (request) => {
      const events = await auditService.getEvents({
        entityType: request.params.entityType,
        entityId: request.params.entityId,
        limit: 100,
      });

      return {
        success: true,
        data: events,
      };
    }
  );
}
