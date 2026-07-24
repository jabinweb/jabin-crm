import { NextRequest, NextResponse } from 'next/server';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';
import { taskService } from '@/lib/tasks/task-service';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';

function isCompanyAdmin(role?: string) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

async function resolveScope(session: { user: { id: string; role?: string } }, req: NextRequest) {
  let companyId: string | undefined;
  if (isCompanyAdmin(session.user.role)) {
    try {
      const ctx = await resolveCompanyContextFromRequest(session as never, req);
      companyId = ctx.companyId;
    } catch {
      /* user-scoped */
    }
  }
  return { userId: session.user.id, companyId };
}

export const GET = withSessionRoute(async (req, { session }, routeContext) => {
  const id = (await routeContext!.params).id as string;
  const scope = await resolveScope(session, req);
  const task = await taskService.getTaskById(id, scope);
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }
  return jsonOk(task);
});

export const PATCH = withSessionRoute(async (req, { session }, routeContext) => {
  const id = (await routeContext!.params).id as string;
  const scope = await resolveScope(session, req);
  const owned = await taskService.getTaskById(id, scope);
  if (!owned) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const body = await req.json();
  const task = await taskService.updateTask(id, {
    title: body.title,
    description: body.description,
    type: body.type,
    priority: body.priority,
    status: body.status,
    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
  });

  return jsonOk(task);
});

export const DELETE = withSessionRoute(async (req, { session }, routeContext) => {
  const id = (await routeContext!.params).id as string;
  const scope = await resolveScope(session, req);
  const owned = await taskService.getTaskById(id, scope);
  if (!owned) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  await taskService.deleteTask(id);
  return jsonOk({ success: true });
});
