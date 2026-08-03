import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { AttendanceStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import {
  evaluateGeoFence,
  getFieldOpsSettings,
} from '@/lib/crm/field-ops';
import {
  evaluateCheckInStatus,
  getActiveShiftForEmployee,
} from '@/lib/hr/shift-attendance';
import { attendanceDateOnly } from '@/lib/hr/leave-year';

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
    const date = attendanceDateOnly(now);

    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: session.user.employeeId,
          date,
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

    const shift = await getActiveShiftForEmployee(session.user.employeeId, now);
    const status = evaluateCheckInStatus(now, shift);
    let lateMinutes = 0;
    if (shift && status === AttendanceStatus.LATE) {
      const [h, m] = shift.startTime.split(':').map((x) => parseInt(x, 10));
      const startMins = (h || 0) * 60 + (m || 0);
      const actual = now.getHours() * 60 + now.getMinutes();
      lateMinutes = Math.max(0, actual - startMins - shift.graceMinutes);
    }

    const meta: Prisma.InputJsonObject = {
      ...(location != null && { location }),
      ...(notes != null && { notes }),
      punchedAt: now.toISOString(),
      ...(shift && {
        shiftId: shift.id,
        shiftName: shift.name,
        shiftStart: shift.startTime,
      }),
      ...(status === AttendanceStatus.LATE && { late: true, lateMinutes }),
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
            status,
            checkIn: now,
            lateMinutes,
            metadata: meta,
          },
        })
      : await prisma.attendance.create({
          data: {
            employeeId: session.user.employeeId,
            date,
            status,
            checkIn: now,
            lateMinutes,
            metadata: meta,
          },
        });

    return new Response(
      JSON.stringify({
        ...attendance,
        outsideGeofence,
        distanceMeters,
        late: status === AttendanceStatus.LATE,
        shift: shift
          ? { id: shift.id, name: shift.name, startTime: shift.startTime }
          : null,
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
