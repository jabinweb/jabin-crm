import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { dealService } from '@/lib/crm/deal-service';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await withModuleAccess('DEALS');

    const params = await context.params;
    const body = await req.json();
    const { action, lostReason } = body;

    let deal;
    if (action === 'next') {
      deal = await dealService.moveToNextStage(params.id);
    } else if (action === 'won') {
      deal = await dealService.markAsWon(params.id);
    } else if (action === 'lost') {
      deal = await dealService.markAsLost(params.id, lostReason || 'No reason provided');
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(deal);
  } catch (error: any) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error moving deal stage:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
