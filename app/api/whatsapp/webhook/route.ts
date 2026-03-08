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
      await whatsAppService.handleTwilioWebhook(formData, userId);
      return NextResponse.json({ ok: true });
    }

    const payload = await req.json();
    await whatsAppService.handleMetaWebhook(payload, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
