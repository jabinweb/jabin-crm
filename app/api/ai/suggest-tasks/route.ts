import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { suggestTasks } from '@/lib/ai/ai-service';
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
    const { leadId, dealId, maxSuggestions } = body;

    // Build context from database
    const context: any = {
      leadId,
      dealId,
    };

    // Fetch lead data if provided
    if (leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, userId: session.user.id },
        include: {
          emailLogs: {
            select: {
              status: true,
              openedAt: true,
              clickedAt: true,
              repliedAt: true,
            },
            orderBy: { sentAt: 'desc' },
            take: 20,
          },
          sequenceEnrollments: {
            where: { status: 'ACTIVE' },
            include: {
              sequence: { select: { name: true } },
            },
          },
        },
      });

      if (lead) {
        context.leadData = {
          companyName: lead.companyName,
          status: lead.status,
          lastContacted: lead.lastContactedAt,
          emailOpens: lead.emailLogs.filter(e => e.openedAt).length,
          emailClicks: lead.emailLogs.filter(e => e.clickedAt).length,
          emailReplies: lead.emailLogs.filter(e => e.repliedAt).length,
        };

        context.sequenceEnrollments = lead.sequenceEnrollments.map(e => ({
          sequenceName: e.sequence.name,
          currentStep: e.currentStep,
          lastSentAt: e.lastStepSentAt,
        }));
      }
    }

    // Fetch deal data if provided
    if (dealId) {
      const deal = await prisma.deal.findFirst({
        where: { id: dealId, userId: session.user.id },
        include: {
          lead: {
            select: {
              companyName: true,
            },
          },
        },
      });

      if (deal) {
        const daysInStage = Math.floor(
          (new Date().getTime() - deal.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        context.dealData = {
          title: deal.title,
          stage: deal.stage,
          value: deal.value,
          daysInStage,
          lastActivity: deal.updatedAt,
        };
      }
    }

    const result = await suggestTasks({
      context,
      maxSuggestions,
      model: profile?.aiModel || DEFAULT_TEXT_MODEL,
      apiKey: userApiKey,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error: any) {
    console.error('AI Task Suggestion Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to suggest tasks' },
      { status: 500 }
    );
  }
}
