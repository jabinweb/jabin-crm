import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { assertProjectTask } from '@/lib/projects/task-activity';

export const GET = withTenantRoute(async (_request, { companyId }, routeContext) => {
  const params = await routeContext!.params;
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const activities = await prisma.projectTaskActivity.findMany({
    where: { taskId: params.taskId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      actor: { select: { id: true, name: true, email: true, image: true } },
    },
  });
  return jsonOk(activities);
});
