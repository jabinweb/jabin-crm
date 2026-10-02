import { NextResponse } from 'next/server';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { canReadProjectDelivery } from '@/lib/projects/task-access';
import { getCompanyProjectTaskSettings } from '@/lib/projects/sync-project-progress';
import {
  resolveDoneStatusIds,
  resolveProjectTaskColumns,
} from '@/lib/projects/task-statuses';

/**
 * The workspace's project task statuses (custom or default), for cross-project
 * views — My work and Backlog — that group rows by status and change it inline.
 */
export const GET = withTenantRoute(async (_request, { session, companyId }) => {
  if (!(await canReadProjectDelivery(session))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const settings = await getCompanyProjectTaskSettings(companyId);
  return jsonOk({
    statuses: resolveProjectTaskColumns(settings),
    doneStatusIds: resolveDoneStatusIds(settings),
  });
});
