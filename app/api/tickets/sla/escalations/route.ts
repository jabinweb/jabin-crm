import { ApiErrors } from '@/lib/api-error-handler';
import { slaService } from '@/lib/crm/sla-service';
import { guardSlaAccess } from '@/lib/api/module-guard';
import { withApiRoute, withSessionRoute, jsonOk } from '@/lib/api/with-route';

function isPrivilegedRole(role: string) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'SUPPORT_MANAGER';
}

export const GET = withApiRoute({
  auth: 'tenant-optional',
  handler: async (_req, { session, companyId }) => {
    await guardSlaAccess(session.user);
    if (!isPrivilegedRole(session.user.role)) {
      throw ApiErrors.forbidden();
    }
    if (!companyId && session.user.role !== 'SUPER_ADMIN') {
      throw ApiErrors.forbidden();
    }

    const breached = companyId
      ? (await slaService.getBreachedActiveTickets(500))
          .filter((t) => t.companyId === companyId)
          .slice(0, 100)
      : await slaService.getBreachedActiveTickets(100);
    return jsonOk({
      total: breached.length,
      tickets: breached,
    });
  },
});

export const POST = withSessionRoute(async (_req, { session }) => {
  await guardSlaAccess(session.user);
  if (!isPrivilegedRole(session.user.role)) {
    throw ApiErrors.forbidden();
  }

  const result = await slaService.runEscalationSweep();
  return jsonOk({
    success: true,
    ...result,
  });
});
