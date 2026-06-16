import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { enrichmentService } from '@/lib/enrichment/enrichment-service';
import { handleApiError } from '@/lib/api-error-handler';
import { guardAgentFeature, isApiException } from '@/lib/api/subscription-guards';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await guardAgentFeature(session.user as { id: string; role?: string }, 'LEADS');

    const { id } = await params;

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead || lead.userId !== session.user.id) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const enrichmentData = await enrichmentService.enrichLead(id);

    return NextResponse.json({ success: true, data: enrichmentData });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error enriching lead:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
