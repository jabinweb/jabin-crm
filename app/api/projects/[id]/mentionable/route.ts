import { NextResponse } from 'next/server';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { listMentionableUsers } from '@/lib/projects/mentions';

/** Workspace staff who can be @mentioned in this project (project team first). */
export const GET = withTenantRoute(async (_request, { companyId }, routeContext) => {
  const projectId = (await routeContext!.params).id;
  const users = await listMentionableUsers(companyId, projectId);
  if (!users) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return jsonOk(users);
});
