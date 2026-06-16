import { NextRequest, NextResponse } from 'next/server';
import { CampaignManager, createEmailServiceFromEnv } from '@/lib/email/email-service';
import { handleApiError } from '@/lib/api-error-handler';
import { withModuleAccess, afterEmailSent } from '@/lib/api/module-guard';
import { isApiException, requireEmailQuotaForCount } from '@/lib/api/subscription-guards';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');

    const { id } = await params;
    const { prisma } = await import('@/lib/prisma');
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
    });

    if (!campaign || campaign.userId !== session.user.id) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const pendingCount = await prisma.emailCampaignLead.count({
      where: {
        campaignId: id,
        status: 'PENDING',
        lead: { email: { not: null } },
      },
    });

    await requireEmailQuotaForCount(session.user.id, pendingCount);

    const emailService = createEmailServiceFromEnv();
    const campaignManager = new CampaignManager(emailService);

    const { sentCount } = await campaignManager.sendCampaign(id);

    if (sentCount > 0) {
      await afterEmailSent(session.user.id, sentCount);
    }

    return NextResponse.json({ success: true, message: 'Campaign sent successfully', sentCount });
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error sending campaign:', error);
    }
    return handleApiError(error);
  }
}
