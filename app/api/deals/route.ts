import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { dealService } from '@/lib/crm/deal-service';

export async function GET(req: NextRequest) {
  try {
    const session = await withModuleAccess('DEALS');

    const { searchParams } = new URL(req.url);
    const stage = searchParams.get('stage') as any;

    const deals = await dealService.getUserDeals(session.user.id, stage);
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
    const { title, value, currency, leadId, expectedCloseDate } = body;

    if (!title || !value || !leadId) {
      return NextResponse.json(
        { error: 'Title, value, and leadId are required' },
        { status: 400 }
      );
    }

    const deal = await dealService.createDeal(session.user.id, {
      title,
      value,
      currency: currency || 'USD',
      leadId,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
    });

    return NextResponse.json(deal, { status: 201 });
  } catch (error: any) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error creating deal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
