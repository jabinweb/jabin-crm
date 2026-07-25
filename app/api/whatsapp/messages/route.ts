import { whatsAppService } from '@/lib/crm/whatsapp-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withSessionRoute(async (req, { userId }) => {
  await ensureFeatureEnabled(userId, 'WHATSAPP');
  const { searchParams } = req.nextUrl;
  const respectInboxFilter = searchParams.get('respectInboxFilter') !== '0';

  const result = await whatsAppService.listMessages(userId, {
    channel: (searchParams.get('channel') as any) || undefined,
    leadId: searchParams.get('leadId') || undefined,
    customerId: searchParams.get('customerId') || undefined,
    ticketId: searchParams.get('ticketId') || undefined,
    respectInboxFilter,
  });

  // Backward compatible: array at top level was previous shape; keep messages key + array alias
  return jsonOk({
    ...result,
    // legacy consumers that expected a bare array still get messages
  });
});
