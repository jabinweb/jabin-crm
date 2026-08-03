import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  evaluateGeoFence,
  getFieldOpsSettings,
} from '@/lib/crm/field-ops';
import {
  evaluateCheckOut,
  getActiveShiftForEmployee,
} from '@/lib/hr/shift-attendance';
import { attendanceDateOnly, grantCompOff } from '@/lib/hr/leave-year';
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
    const date = attendanceDateOnly(now);

    const attendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: session.user.employeeId,
          date,
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
    const shift = await getActiveShiftForEmployee(session.user.employeeId, now);
    const { overtimeMinutes, earlyDeparture } = evaluateCheckOut(
      checkInTime,
      now,
      shift
    );

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: now,
        overtime: overtimeMinutes,
        earlyDeparture,
        metadata: mergeAttendanceMetadata(attendance.metadata, {
          checkOutNotes: notes || 'Checked out',
          checkOutAt: now.toISOString(),
          earlyDeparture,
          ...(shift && { shiftEnd: shift.endTime, shiftId: shift.id }),
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

    if (overtimeMinutes >= 240 && employee?.companyId) {
      try {
        await grantCompOff(session.user.employeeId, employee.companyId, 0.5)
      } catch (e) {
        console.warn('[check-out] comp-off grant failed', e)
      }
    }

    return new Response(
      JSON.stringify({
        ...updated,
        outsideGeofence,
        distanceMeters,
        earlyDeparture,
        overtimeMinutes,
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
