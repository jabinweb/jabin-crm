import { NextRequest, NextResponse } from 'next/server';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';
import { taskService } from '@/lib/tasks/task-service';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';

function isCompanyAdmin(role?: string) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export const GET = withSessionRoute(async (req, { userId, session }) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? undefined;
  const priority = searchParams.get('priority') ?? undefined;
  const type = searchParams.get('type') ?? undefined;
  const overdue = searchParams.get('overdue') === 'true';

  let companyId: string | undefined;
  if (isCompanyAdmin(session.user.role)) {
    try {
      const ctx = await resolveCompanyContextFromRequest(session, req);
      companyId = ctx.companyId;
    } catch {
      /* user-scoped */
    }
  }

  const tasks = await taskService.getUserTasks(userId, {
    status,
    priority,
    type,
    overdue,
    companyId,
  });

  return jsonOk(tasks);
});

export const POST = withSessionRoute(async (req, { userId }) => {
  const body = await req.json();
  const { title, description, type, priority, dueDate, leadId, dealId } = body;

  if (!title || !type) {
    return NextResponse.json({ error: 'Title and type are required' }, { status: 400 });
  }

  const task = await taskService.createTask(userId, {
    title,
    description,
    type,
    priority: priority || 'MEDIUM',
    dueDate: dueDate ? new Date(dueDate) : undefined,
    leadId,
    dealId,
  });

  return jsonOk(task, { status: 201 });
});
