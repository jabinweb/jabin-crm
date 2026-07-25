import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest } from '@/lib/validations/server';
import { whatsAppService } from '@/lib/crm/whatsapp-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

const sendWhatsAppSchema = z
  .object({
    toPhone: z.string().min(6),
    message: z.string().optional().default(''),
    channel: z.enum(['SALES', 'SERVICE']),
    leadId: z.string().optional(),
    customerId: z.string().optional(),
    ticketId: z.string().optional(),
    quotedId: z.string().optional(),
    media: z
      .object({
        type: z.enum(['image', 'video', 'audio', 'document']),
        mimetype: z.string().min(3),
        fileName: z.string().optional(),
        dataBase64: z.string().min(8),
      })
      .optional(),
    react: z
      .object({
        emoji: z.string(),
        targetId: z.string().min(1),
        targetFromMe: z.boolean().optional(),
      })
      .optional(),
  })
  .refine(
    (v) => !!(v.message?.trim() || v.media || v.react),
    { message: 'message, media, or react is required' }
  );

export const POST = withSessionRoute(async (req, { userId }) => {
  await ensureFeatureEnabled(userId, 'WHATSAPP');
  const body = await validateRequest(req, sendWhatsAppSchema);

  const message = await whatsAppService.sendMessage({
    userId,
    toPhone: body.toPhone,
    message: body.message || '',
    channel: body.channel,
    leadId: body.leadId,
    customerId: body.customerId,
    ticketId: body.ticketId,
    quotedId: body.quotedId,
    media: body.media,
    react: body.react,
  });

  return jsonOk(message, { status: 201 });
});
