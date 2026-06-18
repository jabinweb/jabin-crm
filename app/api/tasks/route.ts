import { NextRequest, NextResponse } from 'next/server';
import { taskService } from '@/lib/tasks/task-service';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withSessionRoute(async (req, { userId }) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? undefined;
  const priority = searchParams.get('priority') ?? undefined;
  const type = searchParams.get('type') ?? undefined;
  const overdue = searchParams.get('overdue') === 'true';

  const tasks = await taskService.getUserTasks(userId, {
    status,
    priority,
    type,
    overdue,
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
