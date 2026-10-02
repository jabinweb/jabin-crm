import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { taskService } from '@/lib/tasks/task-service';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Same workspace scope as the Follow-ups list
    let companyId: string | undefined;
    try {
      companyId = (await resolveCompanyContextFromRequest(session, req)).companyId;
    } catch {
      /* own tasks only */
    }
    const role = session.user.role;
    const stats = await taskService.getTaskStats(session.user.id, {
      companyId,
      isAdmin: role === 'ADMIN' || role === 'SUPER_ADMIN',
    });
    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Error fetching task stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
