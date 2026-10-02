import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleRouteError } from '@/lib/api/tenant-response';
import { withModuleAccess, afterCampaignCreated } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';

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

    const { companyId } = await resolveCompanyContextFromRequest(session, request);
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, companyId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
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
    return handleRouteError(error);
  }
}
