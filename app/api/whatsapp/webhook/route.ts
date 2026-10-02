import { NextRequest, NextResponse } from 'next/server';
import { whatsAppService } from '@/lib/crm/whatsapp-service';
import { handleApiError } from '@/lib/api-error-handler';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');
  const userId = req.nextUrl.searchParams.get('userId');

  if (mode !== 'subscribe' || !token || !challenge || !userId) {
    return NextResponse.json({ error: 'Invalid webhook verification request' }, { status: 400 });
  }

  const config = await prisma.whatsAppProviderConfig.findUnique({
    where: { userId },
  });
  const expected = config?.webhookVerifyToken ? decrypt(config.webhookVerifyToken) : null;

  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 403 });
  }

  return new NextResponse(challenge, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    const userId = req.nextUrl.searchParams.get('userId') || undefined;
    const provider = req.nextUrl.searchParams.get('provider');

    if (provider === 'TWILIO' || contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      const formData = new URLSearchParams(text);
      // Twilio signs the exact public URL it called; rebuild it from the app base URL
      // (req.url can be an internal host behind a proxy).
      const publicUrl = `${(process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '')}${req.nextUrl.pathname}${req.nextUrl.search}`;
      if (
        !userId ||
        !(await whatsAppService.verifyTwilioSignature(
          userId,
          publicUrl,
          formData,
          req.headers.get('x-twilio-signature')
        ))
      ) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
      await whatsAppService.handleTwilioWebhook(formData, userId);
      return NextResponse.json({ ok: true });
    }

    const rawBody = await req.text();
    const payload = JSON.parse(rawBody || '{}');
    if (provider === 'SUMMORA') {
      // The service only checks the HMAC when the header is present — an unsigned
      // request must not get through when this user has a signing secret.
      const signature = req.headers.get('x-summora-signature');
      if (!signature && userId) {
        const config = await prisma.whatsAppProviderConfig.findUnique({
          where: { userId },
          select: { webhookVerifyToken: true },
        });
        if (config?.webhookVerifyToken) {
          return NextResponse.json({ error: 'Missing webhook signature' }, { status: 401 });
        }
      }
      await whatsAppService.handleSummoraWebhook(
        payload,
        {
          signature: req.headers.get('x-summora-signature'),
          rawBody,
        },
        userId
      );
      return NextResponse.json({ ok: true });
    }
    // Verified when META_APP_SECRET is configured (null = cannot verify).
    const metaOk = await whatsAppService.verifyMetaSignature(
      rawBody,
      req.headers.get('x-hub-signature-256')
    );
    if (metaOk === false) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }
    await whatsAppService.handleMetaWebhook(payload, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
