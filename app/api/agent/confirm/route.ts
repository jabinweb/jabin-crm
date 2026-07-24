import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { confirmToolRun } from '@/lib/agent/runner';
import { confirmWriteSchema } from '@/lib/agent/tools';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role === 'CUSTOMER' || session.user.role === 'EMPLOYEE') {
      return NextResponse.json({ error: 'Ops Agent is for CRM staff' }, { status: 403 });
    }

    const ctx = await resolveCompanyContextFromRequest(session, req);
    const body = await req.json();
    const parsed = confirmWriteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const result = await confirmToolRun({
      companyId: ctx.companyId,
      userId: session.user.id,
      userRole: String(session.user.role || 'SALES'),
      userName: session.user.name,
      toolRunId: parsed.data.toolRunId,
      action: parsed.data.action,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/agent/confirm]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Confirm failed' },
      { status: 500 }
    );
  }
}
