import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveDocumentCurrency } from '@/lib/currency/resolve-document';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';

/**
 * Resolve currency for new CRM documents.
 * GET /api/currency/resolve?customerId=&customerEmail=
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const customerEmail = searchParams.get('customerEmail');

    let companyId: string | undefined;
    try {
      const ctx = await resolveCompanyContextFromRequest(session, req);
      companyId = ctx.companyId;
    } catch {
      /* optional */
    }

    const currency = await resolveDocumentCurrency({
      customerId,
      customerEmail,
      companyId,
      userId: session.user.id,
    });

    return NextResponse.json({ currency });
  } catch (error) {
    console.error('[api/currency/resolve]', error);
    return NextResponse.json({ error: 'Failed to resolve currency' }, { status: 500 });
  }
}
