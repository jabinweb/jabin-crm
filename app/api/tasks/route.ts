import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { taskService } from '@/lib/tasks/task-service';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as any;
    const priority = searchParams.get('priority') as any;
    const type = searchParams.get('type') as any;
    const overdue = searchParams.get('overdue') === 'true';

    const tasks = await taskService.getUserTasks(session.user.id, {
      status,
      priority,
      type,
      overdue,
    });

    return NextResponse.json(tasks);
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, type, priority, dueDate, leadId, dealId } = body;

    if (!title || !type) {
      return NextResponse.json(
        { error: 'Title and type are required' },
        { status: 400 }
      );
    }

    const task = await taskService.createTask(session.user.id, {
      title,
      description,
      type,
      priority: priority || 'MEDIUM',
      dueDate: dueDate ? new Date(dueDate) : undefined,
      leadId,
      dealId,
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error: any) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
