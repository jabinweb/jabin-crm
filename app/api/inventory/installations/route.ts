import { withTenantRoute, withStaffRoute } from '@/lib/api/with-route';
import {
  createCustomerInstallation,
  listCustomerInstallations,
} from '@/lib/api/inventory-installations';

/**
 * Customer asset installations (registered equipment at a customer site).
 * Staff only (withStaffRoute rejects portal customers); always scoped to the workspace.
 */
export const GET = withStaffRoute(async (request, { companyId }) =>
  listCustomerInstallations(request, companyId)
);

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  const body = await request.json();
  return createCustomerInstallation(session, body, companyId);
});
