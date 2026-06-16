import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { dealService } from '@/lib/crm/deal-service';

export async function GET(req: NextRequest) {
  try {
    const session = await withModuleAccess('DEALS');

    const stats = await dealService.getPipelineStats(session.user.id);
    return NextResponse.json(stats);
  } catch (error: any) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error fetching pipeline stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
