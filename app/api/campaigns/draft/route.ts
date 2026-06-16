import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { withModuleAccess, afterCampaignCreated } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';

export async function POST(request: NextRequest) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH', { quota: 'campaigns' });

    const { 
      leadId, 
      subject, 
      body, 
      recipientEmail,
      recipientName,
      companyName 
    } = await request.json();

    if (!leadId || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create a campaign for this draft
    const campaign = await prisma.emailCampaign.create({
      data: {
        name: `Draft: ${companyName || 'Lead'}`,
        subject,
        emailTemplate: body,
        fromName: session.user.name || 'Your Name',
        fromEmail: session.user.email,
        status: 'DRAFT',
        userId: session.user.id,
        totalRecipients: 1,
      },
    });

    // Link the lead to the campaign
    await prisma.emailCampaignLead.create({
      data: {
        campaignId: campaign.id,
        leadId,
        status: 'PENDING',
      },
    });

    // Log activity
    await prisma.leadActivity.create({
      data: {
        leadId,
        activityType: 'EMAIL_SENT',
        description: `Email draft created: ${subject}`,
        userId: session.user.id,
      },
    });

    await afterCampaignCreated(session.user.id);

    return NextResponse.json({ 
      campaign,
      message: 'Draft saved successfully' 
    });
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error saving draft:', error);
    }
    return handleApiError(error);
  }
}
