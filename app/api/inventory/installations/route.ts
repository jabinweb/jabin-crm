import { NextRequest } from 'next/server';
import { withTenantRoute, withStaffRoute, jsonOk } from '@/lib/api/with-route';
import {
  createCustomerInstallation,
  listCustomerInstallations,
} from '@/lib/api/inventory-installations';

/** Customer asset installations (registered equipment at a customer site). */
export const GET = withStaffRoute(async (request) => listCustomerInstallations(request));

export const POST = withTenantRoute(async (request, { session }) => {
  const body = await request.json();
  return createCustomerInstallation(session, body);
});
