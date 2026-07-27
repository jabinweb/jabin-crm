import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  evaluateGeoFence,
  getFieldOpsSettings,
} from '@/lib/crm/field-ops';

function mergeAttendanceMetadata(
  existing: Prisma.JsonValue | null | undefined,
  patch: Prisma.InputJsonObject
): Prisma.InputJsonObject {
  const base =
    existing !== null &&
    typeof existing === 'object' &&
    !Array.isArray(existing)
      ? ({ ...(existing as Prisma.JsonObject) } as Prisma.InputJsonObject)
      : {};
  return { ...base, ...patch };
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.employeeId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { latitude, longitude, accuracy, notes } = body as {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      notes?: string;
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId: session.user.employeeId,
        createdAt: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (!attendance?.checkIn) {
      return new Response(JSON.stringify({ error: 'No check-in record found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (attendance.checkOut) {
      return new Response(JSON.stringify({ error: 'Already checked out' }), {
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

    const checkInTime = new Date(attendance.checkIn);
    const overtimeMinutes = Math.max(
      0,
      Math.floor((now.getTime() - checkInTime.getTime()) / (1000 * 60) - 480)
    );

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: now,
        overtime: overtimeMinutes,
        metadata: mergeAttendanceMetadata(attendance.metadata, {
          checkOutNotes: notes || 'Checked out',
          checkOutAt: now.toISOString(),
          ...(typeof latitude === 'number' &&
            typeof longitude === 'number' && {
              checkOutLat: latitude,
              checkOutLng: longitude,
              checkOutAccuracy: typeof accuracy === 'number' ? accuracy : null,
              checkOutOutsideGeofence: outsideGeofence,
              checkOutDistanceMeters: distanceMeters,
              ...(outsideGeofence ? { checkOutFlag: 'OUTSIDE_GEOFENCE' } : {}),
            }),
        }),
      },
    });

    return new Response(
      JSON.stringify({
        ...updated,
        outsideGeofence,
        distanceMeters,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[API] Check-out error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
