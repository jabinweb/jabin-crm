import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export function trackingPixelResponse(): Response {
  return new Response(new Uint8Array(TRACKING_PIXEL), {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

function clientMeta(request: NextRequest) {
  return {
    ipAddress:
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  };
}

/** Track an email campaign open by {@link EmailCampaignLead} id. */
export async function trackCampaignEmailOpen(
  campaignLeadId: string,
  request: NextRequest
): Promise<void> {
  const campaignLead = await prisma.emailCampaignLead.findUnique({
    where: { id: campaignLeadId },
    include: { lead: true, campaign: true },
  });

  if (!campaignLead || campaignLead.status !== 'SENT') return;

  const meta = clientMeta(request);

  await prisma.emailCampaignLead.update({
    where: { id: campaignLeadId },
    data: { status: 'OPENED', openedAt: new Date() },
  });

  await prisma.emailCampaign.update({
    where: { id: campaignLead.campaignId },
    data: { openCount: { increment: 1 } },
  });

  await prisma.emailEvent.create({
    data: {
      campaignId: campaignLead.campaignId,
      leadEmail: campaignLead.lead.email || '',
      eventType: 'OPENED',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });

  await prisma.leadActivity.create({
    data: {
      leadId: campaignLead.leadId,
      activityType: 'EMAIL_OPENED',
      description: `Opened email: ${campaignLead.campaign.name}`,
      metadata: { campaignId: campaignLead.campaignId },
    },
  });
}

/** Track an email campaign link click by {@link EmailCampaignLead} id. */
export async function trackCampaignEmailClick(
  campaignLeadId: string,
  targetUrl: string,
  request: NextRequest
): Promise<void> {
  const campaignLead = await prisma.emailCampaignLead.findUnique({
    where: { id: campaignLeadId },
    include: { lead: true },
  });

  if (!campaignLead) return;
  if (campaignLead.status !== 'SENT' && campaignLead.status !== 'OPENED') return;

  const meta = clientMeta(request);

  await prisma.emailCampaignLead.update({
    where: { id: campaignLeadId },
    data: { status: 'CLICKED', clickedAt: new Date() },
  });

  await prisma.emailCampaign.update({
    where: { id: campaignLead.campaignId },
    data: { clickCount: { increment: 1 } },
  });

  await prisma.emailEvent.create({
    data: {
      campaignId: campaignLead.campaignId,
      leadEmail: campaignLead.lead.email || '',
      eventType: 'CLICKED',
      metadata: { url: targetUrl },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });

  await prisma.leadActivity.create({
    data: {
      leadId: campaignLead.leadId,
      activityType: 'EMAIL_CLICKED',
      description: 'Clicked link in email',
      metadata: { campaignId: campaignLead.campaignId, url: targetUrl },
    },
  });
}
