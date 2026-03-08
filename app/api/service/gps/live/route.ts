import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { handleApiError } from '@/lib/api-error-handler';
import { gpsService } from '@/lib/crm/gps-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await ensureFeatureEnabled(session.user.id, 'SERVICE_GPS');
    const hours = parseInt(req.nextUrl.searchParams.get('hours') || '8', 10);
    const snapshot = await gpsService.getLiveSnapshot(Number.isFinite(hours) ? hours : 8);
    return NextResponse.json(snapshot);
  } catch (error) {
    return handleApiError(error);
  }
}
