import { z } from 'zod';
import { validateRequest } from '@/lib/validations/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

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

export const GET = withSessionRoute(async (_req, { userId }) => {
  await ensureFeatureEnabled(userId, 'WHATSAPP');
  const config = await prisma.whatsAppProviderConfig.findUnique({
    where: { userId },
  });

  if (!config) {
    return jsonOk({
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

  return jsonOk({
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
});

export const POST = withSessionRoute(async (req, { userId }) => {
  await ensureFeatureEnabled(userId, 'WHATSAPP');
  const body = await validateRequest(req, saveConfigSchema);

  const existing = await prisma.whatsAppProviderConfig.findUnique({
    where: { userId },
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
    where: { userId },
    update: {
      provider: body.provider,
      isActive: body.isActive ?? body.provider !== 'DISABLED',
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
      userId,
      provider: body.provider,
      isActive: body.isActive ?? body.provider !== 'DISABLED',
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

  return jsonOk({
    provider: config.provider,
    isActive: config.isActive,
    hasTwilioAuthToken: !!config.twilioAuthToken,
    hasMetaAccessToken: !!config.metaAccessToken,
    hasWebhookVerifyToken: !!config.webhookVerifyToken,
  });
});
