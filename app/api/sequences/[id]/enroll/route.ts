import { NextRequest, NextResponse } from 'next/server';
import { sequenceService } from '@/lib/crm/sequence-service';
import { handleApiError } from '@/lib/api-error-handler';
import { withModuleAccess } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await withModuleAccess('EMAIL_OUTREACH');

    const params = await context.params;
    const body = await req.json();
    const { leadIds } = body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: 'leadIds array is required' },
        { status: 400 }
      );
    }

    const results = await Promise.allSettled(
      leadIds.map((leadId: string) =>
        sequenceService.enrollLead(params.id, leadId)
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({
      total: leadIds.length,
      succeeded,
      failed,
    });
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error enrolling leads:', error);
    }
    return handleApiError(error);
  }
}
