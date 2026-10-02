import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { unsubscribeService } from '@/lib/crm/unsubscribe-service';
import { resolveCompanyContextFromRequest, TenantError } from '@/lib/auth/company-membership';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const list = await unsubscribeService.getUnsubscribeList(session.user.id);
    return NextResponse.json(list);
  } catch (error: any) {
    console.error('Error fetching unsubscribe list:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req);

    const body = await req.json().catch(() => null);
    const emails = body?.emails;

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json(
        { error: 'emails array is required' },
        { status: 400 }
      );
    }

    const cleaned = (emails as unknown[])
      .filter((e: unknown): e is string => typeof e === 'string')
      .map((e: string) => e.trim().toLowerCase())
      .filter((e: string) => e.includes('@'));

    // Lead/queue side effects are limited to the caller's workspace.
    const result = await unsubscribeService.bulkImport(cleaned, session.user.id, companyId);
    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error bulk importing unsubscribes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
