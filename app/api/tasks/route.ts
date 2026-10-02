import { NextRequest, NextResponse } from 'next/server';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';
import { taskService } from '@/lib/tasks/task-service';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { prisma } from '@/lib/prisma';

function isCompanyAdmin(role?: string) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export const GET = withSessionRoute(async (req, { userId, session }) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? undefined;
  const priority = searchParams.get('priority') ?? undefined;
  const type = searchParams.get('type') ?? undefined;
  const overdue = searchParams.get('overdue') === 'true';

  // Everyone's list is scoped to the current workspace; admins see all of it
  let companyId: string | undefined;
  try {
    const ctx = await resolveCompanyContextFromRequest(session, req);
    companyId = ctx.companyId;
  } catch {
    /* no workspace context: only the user's own tasks */
  }

  const tasks = await taskService.getUserTasks(userId, {
    status,
    priority,
    type,
    overdue,
    companyId,
    isAdmin: isCompanyAdmin(session.user.role),
  });

  return jsonOk(tasks);
});

const TASK_TYPES = ['CALL', 'EMAIL', 'MEETING', 'FOLLOW_UP', 'TODO', 'DEMO', 'PROPOSAL'];
const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const POST = withSessionRoute(async (req, { userId, session }) => {
  const body = await req.json().catch(() => ({}));
  const { title, description, type, priority, dueDate } = body;
  const leadId = typeof body.leadId === 'string' && body.leadId ? body.leadId : undefined;
  const dealId = typeof body.dealId === 'string' && body.dealId ? body.dealId : undefined;

  if (!title || !type) {
    return NextResponse.json({ error: 'Title and type are required' }, { status: 400 });
  }
  if (!TASK_TYPES.includes(type) || (priority && !TASK_PRIORITIES.includes(priority))) {
    return NextResponse.json({ error: 'Invalid type or priority' }, { status: 400 });
  }
  if (dueDate && Number.isNaN(new Date(dueDate).getTime())) {
    return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
  }

  // A linked lead / deal must belong to the workspace making the request
  if (leadId || dealId) {
    let companyId: string | undefined;
    try {
      companyId = (await resolveCompanyContextFromRequest(session, req)).companyId;
    } catch {
      /* no workspace */
    }
    if (!companyId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }
    if (leadId && !(await prisma.lead.count({ where: { id: leadId, companyId } }))) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    if (dealId && !(await prisma.deal.count({ where: { id: dealId, lead: { companyId } } }))) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }
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
