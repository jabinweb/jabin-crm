import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-middleware';
import { validateRequest } from '@/lib/validation';
import { handleApiError } from '@/lib/api-error-handler';
import { gpsService } from '@/lib/crm/gps-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';

const createLocationSchema = z.object({
  technicianId: z.string().optional(),
  ticketId: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),
  speed: z.number().optional(),
  heading: z.number().optional(),
  source: z.enum(['PWA', 'DEVICE', 'MANUAL']).optional(),
  capturedAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await ensureFeatureEnabled(session.user.id, 'SERVICE_GPS');
    const body = await validateRequest(req, createLocationSchema);
    const technicianId = session.user.role === 'TECHNICIAN' ? session.user.id : body.technicianId;

    if (!technicianId) {
      return NextResponse.json({ error: 'technicianId is required' }, { status: 400 });
    }

    const log = await gpsService.logLocation({
      ...body,
      technicianId,
      capturedAt: body.capturedAt ? new Date(body.capturedAt) : undefined,
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await ensureFeatureEnabled(session.user.id, 'SERVICE_GPS');
    const { searchParams } = req.nextUrl;
    const logs = await gpsService.listLocations({
      technicianId: searchParams.get('technicianId') || undefined,
      ticketId: searchParams.get('ticketId') || undefined,
      since: searchParams.get('since') ? new Date(searchParams.get('since')!) : undefined,
    });
    return NextResponse.json(logs);
  } catch (error) {
    return handleApiError(error);
  }
}
