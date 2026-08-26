import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { fetchMyProjectTasks } from '@/lib/projects/my-tasks-query';

/** Project delivery tasks assigned to the logged-in employee's user account. */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let companyId = session.user.companyId ?? null;
    if (!companyId && session.user.employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: session.user.employeeId },
        select: { companyId: true },
      });
      companyId = employee?.companyId ?? null;
    }

    if (!companyId) {
      return NextResponse.json([]);
    }

    const tasks = await fetchMyProjectTasks(session.user.id, companyId);
    return NextResponse.json(tasks);
  } catch (e) {
    console.error('[employee/project-tasks]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
