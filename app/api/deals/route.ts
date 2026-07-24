import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { dealService } from '@/lib/crm/deal-service';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';

function isCompanyAdmin(role?: string) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export async function GET(req: NextRequest) {
  try {
    const session = await withModuleAccess('DEALS');
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get('stage') || undefined;

    let companyId: string | undefined;
    if (isCompanyAdmin(session.user.role)) {
      try {
        const ctx = await resolveCompanyContextFromRequest(session, req);
        companyId = ctx.companyId;
      } catch {
        /* fall back to user-scoped */
      }
    }

    const deals = await dealService.getUserDeals(session.user.id, {
      stage,
      companyId,
    });
    return NextResponse.json(deals);
  } catch (error: any) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error fetching deals:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await withModuleAccess('DEALS');

    const body = await req.json();
    const { title, value, currency, leadId, expectedCloseDate, stage, probability, notes } = body;

    if (!title || value == null || !leadId) {
      return NextResponse.json(
        { error: 'Title, value, and leadId are required' },
        { status: 400 }
      );
    }

    const deal = await dealService.createDeal(session.user.id, {
      title,
      value: Number(value),
      currency: currency || undefined,
      leadId,
      stage: stage || 'PROSPECTING',
      probability: probability != null ? Number(probability) : 50,
      notes,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
    });

    return NextResponse.json(deal, { status: 201 });
  } catch (error: any) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error creating deal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
