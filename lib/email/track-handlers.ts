import { NextRequest, NextResponse } from 'next/server';
import { trackEmailOpen, trackEmailClick } from '@/lib/email/email-logger';
import {
  trackCampaignEmailClick,
  trackCampaignEmailOpen,
  trackingPixelResponse,
} from '@/lib/email/campaign-tracking';
import { prisma } from '@/lib/prisma';

type IdParams = { params: Promise<{ id: string }> };

/** Only allow absolute http(s) redirect targets (no javascript:, data:, etc.). */
function safeRedirectUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Canonical open-tracking pixel.
 * Accepts EmailLog id (CRM sends) or EmailCampaignLead id (campaign sends).
 */
export async function handleEmailOpenTrack(
  request: NextRequest,
  { params }: IdParams
): Promise<Response> {
  try {
    const { id } = await params;

    const emailLog = await prisma.emailLog.findUnique({
      where: { id },
      select: { id: true },
    });

    if (emailLog) {
      await trackEmailOpen(id);
    } else {
      await trackCampaignEmailOpen(id, request);
    }

    return trackingPixelResponse();
  } catch (error) {
    console.error('Error tracking email open:', error);
    return trackingPixelResponse();
  }
}

/**
 * Canonical click-tracking redirect.
 * Accepts EmailLog id (CRM sends) or EmailCampaignLead id (campaign sends).
 */
export async function handleEmailClickTrack(
  request: NextRequest,
  { params }: IdParams
): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const url = safeRedirectUrl(searchParams.get('url'));
  // Only redirect for ids we actually issued; otherwise this is an open redirect.
  let known = false;

  try {
    const { id } = await params;

    const emailLog = await prisma.emailLog.findUnique({
      where: { id },
      select: { id: true },
    });

    if (emailLog) {
      known = true;
      await trackEmailClick(id);
    } else {
      const campaignLead = await prisma.emailCampaignLead.findUnique({
        where: { id },
        select: { id: true },
      });
      if (campaignLead) {
        known = true;
        if (url) await trackCampaignEmailClick(id, url, request);
      }
    }

    if (!known) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (url) return NextResponse.redirect(url);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking email click:', error);
    if (url && known) return NextResponse.redirect(url);
    return NextResponse.json({ error: 'Failed to track click' }, { status: 500 });
  }
}
