import { ApiErrors } from '@/lib/api-error-handler';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';
import { globalSearch } from '@/lib/crm/global-search';

export const GET = withStaffRoute(async (req, { companyId }) => {
  if (!companyId) {
    throw ApiErrors.badRequest('Company context required');
  }

  const q = req.nextUrl.searchParams.get('q') || req.nextUrl.searchParams.get('query') || '';
  const results = await globalSearch(companyId, q);

  const groups = results.reduce<Record<string, typeof results>>((acc, item) => {
    (acc[item.type] ??= []).push(item);
    return acc;
  }, {});

  return jsonOk({ results, groups, meta: { total: results.length, q: q.trim() } });
});
