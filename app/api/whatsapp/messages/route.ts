import { whatsAppService } from '@/lib/crm/whatsapp-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withSessionRoute(async (req, { userId }) => {
  await ensureFeatureEnabled(userId, 'WHATSAPP');
  const { searchParams } = req.nextUrl;
  const respectInboxFilter = searchParams.get('respectInboxFilter') !== '0';
  const before = searchParams.get('before') || undefined;
  const chatJid = searchParams.get('chatJid') || undefined;
  const limitRaw = Number(searchParams.get('limit') || 100);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 100;

  const result = await whatsAppService.listMessages(userId, {
    channel: (searchParams.get('channel') as any) || undefined,
    leadId: searchParams.get('leadId') || undefined,
    customerId: searchParams.get('customerId') || undefined,
    ticketId: searchParams.get('ticketId') || undefined,
    respectInboxFilter,
    before,
    chatJid,
    limit,
  });

  return jsonOk(result);
});
