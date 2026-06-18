import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { reportError } from '@/lib/monitoring/error-reporter';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json().catch(() => ({}));

    await reportError(new Error(String(body.message ?? 'Client error')), {
      digest: typeof body.digest === 'string' ? body.digest : undefined,
      pathname: typeof body.pathname === 'string' ? body.pathname : undefined,
      userId: session?.user?.id,
      companyId: session?.user?.companyId ?? session?.user?.primaryCompanyId,
      source: typeof body.source === 'string' ? body.source : 'client',
      metadata: typeof body.metadata === 'object' ? body.metadata : undefined,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
