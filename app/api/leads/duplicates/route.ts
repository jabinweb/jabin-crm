import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findAllDuplicates, findDuplicatesForLead } from '@/lib/leads/duplicate-detector';
import { handleApiError } from '@/lib/api-error-handler';
import { guardAgentFeature, isApiException } from '@/lib/api/subscription-guards';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await guardAgentFeature(session.user as { id: string; role?: string }, 'LEADS');

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    const threshold = parseFloat(searchParams.get('threshold') || '0.8');

    if (leadId) {
      // Find duplicates for a specific lead
      const duplicates = await findDuplicatesForLead(leadId, session.user.id, threshold);
      
      return NextResponse.json({
        leadId,
        duplicates,
        total: duplicates.length,
      });
    } else {
      // Find all duplicate groups
      const duplicateGroups = await findAllDuplicates(session.user.id, threshold);
      
      const summary = {
        totalGroups: duplicateGroups.length,
        totalDuplicates: duplicateGroups.reduce((sum, group) => sum + group.totalMatches, 0),
        exactMatches: duplicateGroups.filter(g => g.matchType === 'exact').length,
        similarMatches: duplicateGroups.filter(g => g.matchType === 'similar').length,
        fuzzyMatches: duplicateGroups.filter(g => g.matchType === 'fuzzy').length,
      };
      
      return NextResponse.json({
        groups: duplicateGroups,
        summary,
      });
    }
  } catch (error: any) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error detecting duplicates:', error);
    return NextResponse.json({ 
      error: 'Failed to detect duplicates',
      details: error.message 
    }, { status: 500 });
  }
}
