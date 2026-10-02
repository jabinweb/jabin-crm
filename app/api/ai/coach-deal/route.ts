import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { coachDeal } from '@/lib/ai/ai-service';
import { prisma } from '@/lib/prisma';
import { DEFAULT_TEXT_MODEL } from '@/lib/ai/generate';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user profile for API key and model preference
    const profile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: { geminiApiKey: true, aiModel: true },
    });

    // Decrypt API key if user has one
    let userApiKey: string | undefined = undefined;
    if (profile?.geminiApiKey) {
      try {
        const { decrypt } = require('@/lib/encryption');
        userApiKey = decrypt(profile.geminiApiKey).trim();
      } catch (error) {
        console.error('Failed to decrypt API key:', error);
      }
    }

    const body = await request.json();
    const { dealId } = body;

    if (!dealId) {
      return NextResponse.json(
        { error: 'Deal ID is required' },
        { status: 400 }
      );
    }

    // Fetch deal data
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, userId: session.user.id },
      include: {
        lead: {
          select: {
            companyName: true,
            industry: true,
            emailLogs: {
              select: {
                openedAt: true,
                clickedAt: true,
                repliedAt: true,
              },
            },
          },
        },
        tasks: {
          select: {
            type: true,
            status: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    });

    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      );
    }

    const daysInCurrentStage = Math.floor(
      (new Date().getTime() - deal.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const dealData = {
      title: deal.title,
      stage: deal.stage,
      value: deal.value,
      probability: deal.probability,
      createdAt: deal.createdAt,
      daysInCurrentStage,
      activities: deal.tasks.map(t => ({
        type: t.type,
        date: t.createdAt,
        notes: t.status === 'COMPLETED' ? `Completed on ${t.completedAt}` : undefined,
      })),
    };

    const leadData = deal.lead ? {
      companyName: deal.lead.companyName,
      industry: deal.lead.industry || undefined,
      emailEngagement: {
        opens: deal.lead.emailLogs.filter(e => e.openedAt).length,
        clicks: deal.lead.emailLogs.filter(e => e.clickedAt).length,
        replies: deal.lead.emailLogs.filter(e => e.repliedAt).length,
      },
    } : undefined;

    const result = await coachDeal({
      dealData,
      leadData,
      model: profile?.aiModel || DEFAULT_TEXT_MODEL,
      apiKey: userApiKey,
    });

    return NextResponse.json({
      success: true,
      coaching: result,
    });

  } catch (error: any) {
    console.error('AI Deal Coaching Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to coach deal' },
      { status: 500 }
    );
  }
}
