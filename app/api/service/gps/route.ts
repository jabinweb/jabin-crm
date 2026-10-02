import { isFieldServiceManager, isFieldServiceUser } from '@/app/api/service/_roles';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { validateRequest } from '@/lib/validations/server';
import { gpsService } from '@/lib/crm/gps-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { isWorkspaceStaff, workspaceStaffWhere } from '@/lib/auth/workspace-staff';

const createLocationSchema = z.object({
  technicianId: z.string().min(1).optional().nullable(),
  ticketId: z.string().min(1).optional().nullable(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().optional().nullable(),
  speed: z.number().finite().optional().nullable(),
  heading: z.number().finite().optional().nullable(),
  source: z.enum(['PWA', 'DEVICE', 'MANUAL']).optional(),
  capturedAt: z.string().datetime().optional(),
});

export const POST = withTenantRoute(async (req, { session, userId, companyId }) => {
  if (!isFieldServiceUser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureFeatureEnabled(userId, 'SERVICE_GPS', companyId);
  // Managers see and log for the whole team; technicians only themselves.
  const isManager = isFieldServiceManager(session);
  const body = await validateRequest(req, createLocationSchema);
  const technicianId = isManager ? body.technicianId || undefined : userId;

  if (!technicianId) {
    return NextResponse.json(
      { error: 'Select a technician to check in' },
      { status: 400 }
    );
  }

  if (technicianId !== userId && !(await isWorkspaceStaff(companyId, technicianId))) {
    return NextResponse.json({ error: 'Technician not found' }, { status: 404 });
  }

  if (body.ticketId) {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: body.ticketId, customer: { companyId } },
      select: { id: true },
    });
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
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

export const GET = withTenantRoute(async (req, { session, userId, companyId }) => {
  if (!isFieldServiceUser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureFeatureEnabled(userId, 'SERVICE_GPS', companyId);
  // Managers see and log for the whole team; technicians only themselves.
  const isManager = isFieldServiceManager(session);
  const { searchParams } = req.nextUrl;
  const technicianId = isManager ? searchParams.get('technicianId') || undefined : userId;
  const ticketId = searchParams.get('ticketId') || undefined;
  const sinceRaw = searchParams.get('since');
  const since = sinceRaw ? new Date(sinceRaw) : undefined;
  if (since && Number.isNaN(since.getTime())) {
    return NextResponse.json({ error: 'Invalid since date' }, { status: 400 });
  }

  // Scope to technicians in this workspace (location logs carry no companyId).
  const logs = await prisma.technicianLocationLog.findMany({
    where: {
      technician: workspaceStaffWhere(companyId),
      ...(technicianId ? { technicianId } : {}),
      ...(ticketId ? { ticketId } : {}),
      ...(since ? { capturedAt: { gte: since } } : {}),
    },
    include: {
      technician: {
        select: { id: true, name: true, email: true },
      },
      ticket: {
        select: { id: true, subject: true, status: true },
      },
    },
    orderBy: { capturedAt: 'desc' },
    take: 500,
  });
  return jsonOk(logs);
});
