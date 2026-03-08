import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-middleware';
import { validateRequest } from '@/lib/validation';
import { handleApiError } from '@/lib/api-error-handler';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { ensureFeatureEnabled } from '@/lib/feature-modules';

const saveConfigSchema = z.object({
  provider: z.enum(['DISABLED', 'TWILIO', 'META_CLOUD']),
  isActive: z.boolean().optional(),
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioFromNumber: z.string().optional(),
  metaAccessToken: z.string().optional(),
  metaPhoneNumberId: z.string().optional(),
  metaBusinessId: z.string().optional(),
  metaApiVersion: z.string().optional(),
  webhookVerifyToken: z.string().optional(),
});

function isMasked(value?: string) {
  return !!value && (value.includes('•') || value.includes('â€¢'));
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await ensureFeatureEnabled(session.user.id, 'WHATSAPP');
    const config = await prisma.whatsAppProviderConfig.findUnique({
      where: { userId: session.user.id },
    });

    if (!config) {
      return NextResponse.json({
        provider: 'DISABLED',
        isActive: false,
        twilioAccountSid: '',
        twilioFromNumber: '',
        metaPhoneNumberId: '',
        metaBusinessId: '',
        metaApiVersion: 'v22.0',
        hasTwilioAuthToken: false,
        hasMetaAccessToken: false,
        hasWebhookVerifyToken: false,
      });
    }

    return NextResponse.json({
      provider: config.provider,
      isActive: config.isActive,
      twilioAccountSid: config.twilioAccountSid || '',
      twilioFromNumber: config.twilioFromNumber || '',
      metaPhoneNumberId: config.metaPhoneNumberId || '',
      metaBusinessId: config.metaBusinessId || '',
      metaApiVersion: config.metaApiVersion || 'v22.0',
      hasTwilioAuthToken: !!config.twilioAuthToken,
      hasMetaAccessToken: !!config.metaAccessToken,
      hasWebhookVerifyToken: !!config.webhookVerifyToken,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await ensureFeatureEnabled(session.user.id, 'WHATSAPP');
    const body = await validateRequest(req, saveConfigSchema);

    const existing = await prisma.whatsAppProviderConfig.findUnique({
      where: { userId: session.user.id },
    });

    const twilioAuthToken =
      body.twilioAuthToken && !isMasked(body.twilioAuthToken)
        ? encrypt(body.twilioAuthToken)
        : existing?.twilioAuthToken;

    const metaAccessToken =
      body.metaAccessToken && !isMasked(body.metaAccessToken)
        ? encrypt(body.metaAccessToken)
        : existing?.metaAccessToken;

    const webhookVerifyToken =
      body.webhookVerifyToken && !isMasked(body.webhookVerifyToken)
        ? encrypt(body.webhookVerifyToken)
        : existing?.webhookVerifyToken;

    const config = await prisma.whatsAppProviderConfig.upsert({
      where: { userId: session.user.id },
      update: {
        provider: body.provider,
        isActive: body.isActive ?? (body.provider !== 'DISABLED'),
        twilioAccountSid: body.twilioAccountSid || null,
        twilioAuthToken: twilioAuthToken || null,
        twilioFromNumber: body.twilioFromNumber || null,
        metaAccessToken: metaAccessToken || null,
        metaPhoneNumberId: body.metaPhoneNumberId || null,
        metaBusinessId: body.metaBusinessId || null,
        metaApiVersion: body.metaApiVersion || 'v22.0',
        webhookVerifyToken: webhookVerifyToken || null,
      },
      create: {
        userId: session.user.id,
        provider: body.provider,
        isActive: body.isActive ?? (body.provider !== 'DISABLED'),
        twilioAccountSid: body.twilioAccountSid || null,
        twilioAuthToken: twilioAuthToken || null,
        twilioFromNumber: body.twilioFromNumber || null,
        metaAccessToken: metaAccessToken || null,
        metaPhoneNumberId: body.metaPhoneNumberId || null,
        metaBusinessId: body.metaBusinessId || null,
        metaApiVersion: body.metaApiVersion || 'v22.0',
        webhookVerifyToken: webhookVerifyToken || null,
      },
    });

    return NextResponse.json({
      provider: config.provider,
      isActive: config.isActive,
      hasTwilioAuthToken: !!config.twilioAuthToken,
      hasMetaAccessToken: !!config.metaAccessToken,
      hasWebhookVerifyToken: !!config.webhookVerifyToken,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
