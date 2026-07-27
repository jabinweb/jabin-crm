import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { AttendanceStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import {
  evaluateGeoFence,
  getFieldOpsSettings,
} from '@/lib/crm/field-ops';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.employeeId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { location, notes, latitude, longitude, accuracy } = body as {
      location?: string;
      notes?: string;
      latitude?: number;
      longitude?: number;
      accuracy?: number;
    };
    const now = new Date();

    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: session.user.employeeId,
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        },
      },
    });

    if (existingAttendance?.checkIn) {
      return new Response(JSON.stringify({ error: 'Already checked in' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: session.user.employeeId },
      select: { companyId: true },
    });

    let outsideGeofence = false;
    let distanceMeters: number | null = null;
    if (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      employee?.companyId
    ) {
      const fieldOps = await getFieldOpsSettings(employee.companyId);
      const evalResult = evaluateGeoFence(fieldOps, latitude, longitude);
      outsideGeofence = evalResult.outside;
      distanceMeters = evalResult.distanceMeters;
      if (outsideGeofence && fieldOps.geoFence.hardBlock) {
        return new Response(
          JSON.stringify({
            error: 'Punch blocked: outside office geo-fence',
            code: 'OUTSIDE_GEOFENCE',
            distanceMeters,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const meta: Prisma.InputJsonObject = {
      ...(location != null && { location }),
      ...(notes != null && { notes }),
      punchedAt: now.toISOString(),
      ...(typeof latitude === 'number' &&
        typeof longitude === 'number' && {
          lat: latitude,
          lng: longitude,
          accuracy: typeof accuracy === 'number' ? accuracy : null,
          outsideGeofence,
          distanceMeters,
          ...(outsideGeofence ? { flag: 'OUTSIDE_GEOFENCE' } : {}),
        }),
    };

    const attendance = existingAttendance
      ? await prisma.attendance.update({
          where: { id: existingAttendance.id },
          data: {
            status: AttendanceStatus.PRESENT,
            checkIn: now,
            metadata: meta,
          },
        })
      : await prisma.attendance.create({
          data: {
            employeeId: session.user.employeeId,
            status: AttendanceStatus.PRESENT,
            checkIn: now,
            metadata: meta,
          },
        });

    return new Response(
      JSON.stringify({
        ...attendance,
        outsideGeofence,
        distanceMeters,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[API] Check-in error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
