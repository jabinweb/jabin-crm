import { NextRequest, NextResponse } from 'next/server';
import { sequenceService } from '@/lib/crm/sequence-service';
import { handleApiError } from '@/lib/api-error-handler';
import { withModuleAccess } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await withModuleAccess('EMAIL_OUTREACH');

    const params = await context.params;
    const stats = await sequenceService.getSequenceWithStats(params.id);
    return NextResponse.json(stats);
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error fetching sequence stats:', error);
    }
    return handleApiError(error);
  }
}
