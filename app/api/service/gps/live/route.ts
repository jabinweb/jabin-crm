import { gpsService } from '@/lib/crm/gps-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withSessionRoute(async (req, { userId }) => {
  await ensureFeatureEnabled(userId, 'SERVICE_GPS');
  const hours = parseInt(req.nextUrl.searchParams.get('hours') || '8', 10);
  const snapshot = await gpsService.getLiveSnapshot(Number.isFinite(hours) ? hours : 8);
  return jsonOk(snapshot);
});
