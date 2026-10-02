import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveCompanyContextFromRequest, TenantError } from '@/lib/auth/company-membership';
import { mergeLeads } from '@/lib/leads/duplicate-detector';
import { handleApiError } from '@/lib/api-error-handler';
import { guardAgentFeature, isApiException } from '@/lib/api/subscription-guards';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await guardAgentFeature(session.user as { id: string; role?: string }, 'LEADS');

    const body = await request.json();
    const { primaryLeadId, duplicateLeadIds, strategy } = body;

    if (!primaryLeadId || !duplicateLeadIds || !Array.isArray(duplicateLeadIds)) {
      return NextResponse.json({ 
        error: 'Primary lead ID and duplicate lead IDs are required' 
      }, { status: 400 });
    }

    if (duplicateLeadIds.length === 0) {
      return NextResponse.json({ 
        error: 'At least one duplicate lead ID is required' 
      }, { status: 400 });
    }

    const validStrategies = ['keep-primary', 'keep-newest', 'keep-most-complete'];
    const { companyId } = await resolveCompanyContextFromRequest(session, request);
    const mergeStrategy = validStrategies.includes(strategy) ? strategy : 'keep-most-complete';

    const result = await mergeLeads(
      primaryLeadId,
      duplicateLeadIds,
      session.user.id,
      mergeStrategy,
      companyId
    );

    return NextResponse.json({
      success: true,
      message: `Successfully merged ${result.deletedCount} duplicate lead(s)`,
      mergedLead: result.mergedLead,
      deletedCount: result.deletedCount,
    });

  } catch (error: any) {
    if (isApiException(error)) return handleApiError(error);
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error merging leads:', error);
    return NextResponse.json({ 
      error: 'Failed to merge leads',
      details: error.message 
    }, { status: 500 });
  }
}
