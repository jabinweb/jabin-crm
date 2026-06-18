import { z } from 'zod';
import { validateRequest } from '@/lib/validations/server';
import { whatsAppService } from '@/lib/crm/whatsapp-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

const sendWhatsAppSchema = z.object({
  toPhone: z.string().min(6),
  message: z.string().min(1),
  channel: z.enum(['SALES', 'SERVICE']),
  leadId: z.string().optional(),
  customerId: z.string().optional(),
  ticketId: z.string().optional(),
});

export const POST = withSessionRoute(async (req, { userId }) => {
  await ensureFeatureEnabled(userId, 'WHATSAPP');
  const body = await validateRequest(req, sendWhatsAppSchema);

  const message = await whatsAppService.sendMessage({
    userId,
    ...body,
  });

  return jsonOk(message, { status: 201 });
});
