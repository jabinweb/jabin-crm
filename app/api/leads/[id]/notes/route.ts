import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
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

    const resolvedParams = await params;
    const { note } = await request.json();

    if (!note || !note.trim()) {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!lead || lead.userId !== session.user.id) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Update lead with note
    await prisma.lead.update({
      where: { id: resolvedParams.id },
      data: { 
        notes: note,
        updatedAt: new Date(),
      },
    });

    // Create activity log
    const activity = await prisma.leadActivity.create({
      data: {
        leadId: resolvedParams.id,
        activityType: 'NOTE_ADDED',
        description: note,
        userId: session.user.id,
      },
    });

    return NextResponse.json(activity);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error adding note:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
