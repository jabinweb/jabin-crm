import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { withModuleAccess, afterCampaignCreated } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';

export async function GET(request: NextRequest) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      prisma.emailCampaign.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { emailCampaignLeads: true },
          },
        },
      }),
      prisma.emailCampaign.count({ where: { userId: session.user.id } }),
    ]);

    return NextResponse.json({
      campaigns,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error fetching campaigns:', error);
    }
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH', { quota: 'campaigns' });

    const data = await request.json();

    // Create campaign
    const campaign = await prisma.emailCampaign.create({
      data: {
        name: data.name,
        subject: data.subject,
        emailTemplate: data.emailTemplate,
        fromName: data.fromName,
        fromEmail: data.fromEmail,
        replyTo: data.replyTo,
        userId: session.user.id,
        status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
    });

    // Add leads to campaign
    if (data.leadIds && data.leadIds.length > 0) {
      await prisma.emailCampaignLead.createMany({
        data: data.leadIds.map((leadId: string) => ({
          campaignId: campaign.id,
          leadId,
          status: 'PENDING',
        })),
      });

      // Update total recipients
      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { totalRecipients: data.leadIds.length },
      });
    }

    await afterCampaignCreated(session.user.id);

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error creating campaign:', error);
    }
    return handleApiError(error);
  }
}
