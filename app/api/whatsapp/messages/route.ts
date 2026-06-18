import { whatsAppService } from '@/lib/crm/whatsapp-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withSessionRoute(async (req, { userId }) => {
  await ensureFeatureEnabled(userId, 'WHATSAPP');
  const { searchParams } = req.nextUrl;

  const messages = await whatsAppService.listMessages(userId, {
    channel: (searchParams.get('channel') as any) || undefined,
    leadId: searchParams.get('leadId') || undefined,
    customerId: searchParams.get('customerId') || undefined,
    ticketId: searchParams.get('ticketId') || undefined,
  });

  return jsonOk(messages);
});
