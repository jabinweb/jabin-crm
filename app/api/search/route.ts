import { ApiErrors } from '@/lib/api-error-handler';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';
import { globalSearch, type GlobalSearchEntityType } from '@/lib/crm/global-search';
import { getFeatureModuleMap } from '@/lib/feature-modules';
import { prisma } from '@/lib/prisma';

export const GET = withStaffRoute(async (req, { companyId, session, userId }) => {
  if (!companyId) {
    throw ApiErrors.badRequest('Company context required');
  }

  const q = req.nextUrl.searchParams.get('q') || req.nextUrl.searchParams.get('query') || '';

  // Results follow the same rules as the list pages they link to: plan modules of this
  // workspace, HR/retainer records for admins only, and non-admins see only their own
  // leads and deals (as /api/leads and /api/deals do).
  const role = session.user.role;
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const modules = await getFeatureModuleMap(userId, companyId);

  let leadEmployeeId: string | null = null;
  if (!isAdmin && modules.LEADS === true) {
    const myEmployee = await prisma.employee.findFirst({
      where: { userId, companyId },
      select: { id: true },
    });
    leadEmployeeId = myEmployee?.id ?? null;
  }

  const include: Partial<Record<GlobalSearchEntityType, boolean>> = {
    lead: modules.LEADS === true && (isAdmin || !!leadEmployeeId),
    deal: modules.DEALS === true,
    invoice: modules.INVOICES === true,
    ticket: modules.TICKETS === true,
    contract: modules.TICKETS === true,
    employee: isAdmin,
    retainer: isAdmin,
  };

  const results = await globalSearch(companyId, q, {
    include,
    leadEmployeeId: isAdmin ? null : leadEmployeeId,
    dealUserId: isAdmin ? null : userId,
  });

  const groups = results.reduce<Record<string, typeof results>>((acc, item) => {
    (acc[item.type] ??= []).push(item);
    return acc;
  }, {});

  return jsonOk({ results, groups, meta: { total: results.length, q: q.trim() } });
});
