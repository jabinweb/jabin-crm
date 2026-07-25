import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest } from '@/lib/validations/server';
import { gpsService } from '@/lib/crm/gps-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

const createLocationSchema = z.object({
  technicianId: z.string().min(1).optional().nullable(),
  ticketId: z.string().min(1).optional().nullable(),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  accuracy: z.number().finite().optional().nullable(),
  speed: z.number().finite().optional().nullable(),
  heading: z.number().finite().optional().nullable(),
  source: z.enum(['PWA', 'DEVICE', 'MANUAL']).optional(),
  capturedAt: z.string().datetime().optional(),
});

export const POST = withSessionRoute(async (req, { session, userId }) => {
  await ensureFeatureEnabled(userId, 'SERVICE_GPS');
  const body = await validateRequest(req, createLocationSchema);
  const technicianId =
    session.user.role === 'TECHNICIAN' ? userId : body.technicianId || undefined;

  if (!technicianId) {
    return NextResponse.json(
      { error: 'Select a technician to check in' },
      { status: 400 }
    );
  }

  const log = await gpsService.logLocation({
    technicianId,
    ticketId: body.ticketId || undefined,
    latitude: body.latitude,
    longitude: body.longitude,
    accuracy: body.accuracy ?? undefined,
    speed: body.speed ?? undefined,
    heading: body.heading ?? undefined,
    source: body.source,
    capturedAt: body.capturedAt ? new Date(body.capturedAt) : undefined,
  });

  return jsonOk(log, { status: 201 });
});

export const GET = withSessionRoute(async (req, { userId }) => {
  await ensureFeatureEnabled(userId, 'SERVICE_GPS');
  const { searchParams } = req.nextUrl;
  const logs = await gpsService.listLocations({
    technicianId: searchParams.get('technicianId') || undefined,
    ticketId: searchParams.get('ticketId') || undefined,
    since: searchParams.get('since') ? new Date(searchParams.get('since')!) : undefined,
  });
  return jsonOk(logs);
});
