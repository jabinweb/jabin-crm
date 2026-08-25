import { NextResponse } from 'next/server';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { canReadProjectDelivery } from '@/lib/projects/task-access';
import { fetchMyProjectTasks } from '@/lib/projects/my-tasks-query';

export const GET = withTenantRoute(async (_request, { session, companyId }) => {
  if (!(await canReadProjectDelivery(session))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tasks = await fetchMyProjectTasks(session.user.id, companyId);
  return jsonOk(tasks);
});
