import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest } from '@/lib/validations/server';
import { gpsService } from '@/lib/crm/gps-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

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

export const POST = withSessionRoute(async (req, { session, userId }) => {
  await ensureFeatureEnabled(userId, 'SERVICE_GPS');
  const body = await validateRequest(req, createLocationSchema);
  const technicianId = session.user.role === 'TECHNICIAN' ? userId : body.technicianId;

  if (!technicianId) {
    return NextResponse.json({ error: 'technicianId is required' }, { status: 400 });
  }

  const log = await gpsService.logLocation({
    ...body,
    technicianId,
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
