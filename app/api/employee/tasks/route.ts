import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  CompanyTaskCategory,
  CompanyTaskPriority,
  CompanyTaskStatus,
} from '@prisma/client';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.employeeId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const tasks = await prisma.companyTask.findMany({
      where: {
        assignedToId: session.user.employeeId,
        status: {
          not: 'COMPLETED',
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        status: true,
        priority: true,
        category: true,
        progress: true,
        attachments: true,
        tags: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return new Response(JSON.stringify(tasks), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[API] Get tasks error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.employeeId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const role = String(session.user.role || '');
    if (!['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req);
    const body = await req.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const assignedToId =
      typeof body.assignedToId === 'string' ? body.assignedToId : session.user.employeeId;

    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const assignee = await prisma.employee.findFirst({
      where: { id: assignedToId, companyId },
      select: { id: true },
    });
    if (!assignee) {
      return new Response(JSON.stringify({ error: 'Assignee not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const task = await prisma.companyTask.create({
      data: {
        title,
        description: typeof body.description === 'string' ? body.description : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        status: (body.status as CompanyTaskStatus) || CompanyTaskStatus.TODO,
        priority: (body.priority as CompanyTaskPriority) || CompanyTaskPriority.MEDIUM,
        category: (body.category as CompanyTaskCategory) || CompanyTaskCategory.GENERAL,
        createdById: session.user.employeeId,
        assignedToId,
        companyId,
        tags: Array.isArray(body.tags)
          ? body.tags.filter((t: unknown) => typeof t === 'string')
          : [],
      },
    });

    return new Response(JSON.stringify(task), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('[API] Create company task error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
