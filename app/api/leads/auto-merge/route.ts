import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { autoMergeDuplicates } from '@/lib/leads/duplicate-detector';
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
    const { exactMatchOnly = true } = body;

    const result = await autoMergeDuplicates(session.user.id, exactMatchOnly);

    return NextResponse.json({
      success: true,
      message: `Successfully auto-merged ${result.mergedCount} duplicate leads across ${result.groupsProcessed} groups`,
      mergedCount: result.mergedCount,
      groupsProcessed: result.groupsProcessed,
    });

  } catch (error: any) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error auto-merging duplicates:', error);
    return NextResponse.json({ 
      error: 'Failed to auto-merge duplicates',
      details: error.message 
    }, { status: 500 });
  }
}
