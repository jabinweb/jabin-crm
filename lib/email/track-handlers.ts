import { NextRequest, NextResponse } from 'next/server';
import { trackEmailOpen, trackEmailClick } from '@/lib/email/email-logger';
import {
  trackCampaignEmailClick,
  trackCampaignEmailOpen,
  trackingPixelResponse,
} from '@/lib/email/campaign-tracking';
import { prisma } from '@/lib/prisma';

type IdParams = { params: Promise<{ id: string }> };

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
  const url = searchParams.get('url');

  try {
    const { id } = await params;

    const emailLog = await prisma.emailLog.findUnique({
      where: { id },
      select: { id: true },
    });

    if (emailLog) {
      await trackEmailClick(id);
    } else if (url) {
      await trackCampaignEmailClick(id, url, request);
    }

    if (url) return NextResponse.redirect(url);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking email click:', error);
    if (url) return NextResponse.redirect(url);
    return NextResponse.json({ error: 'Failed to track click' }, { status: 500 });
  }
}
