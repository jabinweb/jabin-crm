import { NextResponse } from 'next/server';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { canReadProjectDelivery } from '@/lib/projects/task-access';
import { fetchCompanyBacklog } from '@/lib/projects/my-tasks-query';

/** Company-wide open ProjectTasks (cross-project backlog). */
export const GET = withTenantRoute(async (request, { session, companyId }) => {
  if (!(await canReadProjectDelivery(session))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  const status = url.searchParams.get('status');
  const assignee = url.searchParams.get('assignee') || 'all';
  const includeDone = url.searchParams.get('includeDone') === '1';

  const tasks = await fetchCompanyBacklog(companyId, {
    projectId,
    status,
    assignee: assignee as 'all' | 'unassigned' | 'me' | string,
    includeDone,
    userId: session.user.id,
  });

  return jsonOk(tasks);
});
