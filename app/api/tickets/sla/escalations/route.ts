import { ApiErrors } from '@/lib/api-error-handler';
import { slaService } from '@/lib/crm/sla-service';
import { guardSlaAccess } from '@/lib/api/module-guard';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

function isPrivilegedRole(role: string) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'SUPPORT_MANAGER';
}

export const GET = withSessionRoute(async (_req, { session }) => {
  await guardSlaAccess(session.user);
  if (!isPrivilegedRole(session.user.role)) {
    throw ApiErrors.forbidden();
  }

  const breached = await slaService.getBreachedActiveTickets(100);
  return jsonOk({
    total: breached.length,
    tickets: breached,
  });
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
