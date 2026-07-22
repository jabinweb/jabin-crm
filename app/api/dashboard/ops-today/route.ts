import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { AttendanceStatus, EmployeeStatus, LeaveStatus } from '@prisma/client';

function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

/** Late if checked in at or after 10:00 local. */
function isLateCheckIn(checkIn: Date | null | undefined) {
  if (!checkIn) return false;
  return checkIn.getHours() > 10 || (checkIn.getHours() === 10 && checkIn.getMinutes() > 0);
}

/**
 * Company-wide attendance + personal punch state + daily sales-activity pulse.
 */
export const GET = withTenantRoute(async (_req, { companyId, userId, employeeId, session }) => {
  const dayStart = startOfLocalDay();
  const dayEnd = endOfLocalDay();

  const activeEmployees = await prisma.employee.findMany({
    where: {
      companyId,
      status: EmployeeStatus.ACTIVE,
      isApproved: true,
    },
    select: {
      id: true,
      name: true,
      department: true,
      userId: true,
    },
  });

  const employeeIds = activeEmployees.map((e) => e.id);

  type AttendanceRow = {
    employeeId: string;
    status: AttendanceStatus;
    checkIn: Date | null;
    checkOut: Date | null;
  };

  type LeaveRow = {
    employeeId: string;
    type: string;
    employee: { name: string };
  };

  const [attendanceRows, leaveRows, myLeadsToday, myActivitiesToday] = await Promise.all([
    employeeIds.length
      ? prisma.attendance.findMany({
          where: {
            employeeId: { in: employeeIds },
            createdAt: { gte: dayStart, lt: dayEnd },
          },
          select: {
            employeeId: true,
            status: true,
            checkIn: true,
            checkOut: true,
          },
        })
      : Promise.resolve([] as AttendanceRow[]),
    employeeIds.length
      ? prisma.leaveRequest.findMany({
          where: {
            employeeId: { in: employeeIds },
            status: LeaveStatus.APPROVED,
            startDate: { lte: dayEnd },
            endDate: { gte: dayStart },
          },
          select: {
            employeeId: true,
            type: true,
            employee: { select: { name: true } },
          },
        })
      : Promise.resolve([] as LeaveRow[]),
    prisma.lead.count({
      where: {
        companyId,
        userId,
        createdAt: { gte: dayStart, lt: dayEnd },
      },
    }),
    prisma.leadActivity.count({
      where: {
        createdAt: { gte: dayStart, lt: dayEnd },
        lead: { companyId },
        OR: [
          { userId },
          ...(employeeId ? [{ employeeId }] : []),
        ],
      },
    }),
  ]);

  const onLeaveIds = new Set(leaveRows.map((l) => l.employeeId));
  const attendanceByEmployee = new Map<string, AttendanceRow>(
    attendanceRows.map((a) => [a.employeeId, a])
  );

  let present = 0;
  let late = 0;
  let workingNow = 0;
  let notArrived = 0;
  const lateList: { id: string; name: string; checkIn: string | null }[] = [];
  const onLeaveSeen = new Set<string>();
  const onLeaveList: { id: string; name: string; type: string }[] = [];

  for (const row of leaveRows) {
    if (onLeaveSeen.has(row.employeeId)) continue;
    onLeaveSeen.add(row.employeeId);
    onLeaveList.push({
      id: row.employeeId,
      name: row.employee.name,
      type: row.type,
    });
  }

  for (const emp of activeEmployees) {
    if (onLeaveIds.has(emp.id)) continue;

    const row = attendanceByEmployee.get(emp.id);
    const status = row?.status;
    const checkedIn = !!row?.checkIn;
    const checkedOut = !!row?.checkOut;

    if (status === AttendanceStatus.ON_LEAVE) {
      if (!onLeaveSeen.has(emp.id)) {
        onLeaveSeen.add(emp.id);
        onLeaveList.push({ id: emp.id, name: emp.name, type: 'Leave' });
      }
      continue;
    }

    const lateHit =
      status === AttendanceStatus.LATE || (checkedIn && isLateCheckIn(row?.checkIn));

    if (checkedIn) {
      present += 1;
      if (lateHit) {
        late += 1;
        lateList.push({
          id: emp.id,
          name: emp.name,
          checkIn: row?.checkIn?.toISOString() ?? null,
        });
      }
      if (!checkedOut) workingNow += 1;
    } else {
      notArrived += 1;
    }
  }

  const onLeave = onLeaveList.length;
  const rosterSize = activeEmployees.length;
  const expected = Math.max(0, rosterSize - onLeave);
  const attendancePercent =
    expected > 0 ? Math.round((present / expected) * 100) : rosterSize === 0 ? 0 : 100;

  let myAttendance: {
    status: string;
    checkIn: string | null;
    checkOut: string | null;
  } | null = null;

  if (employeeId) {
    const mine = attendanceByEmployee.get(employeeId);
    if (mine) {
      myAttendance = {
        status: mine.status,
        checkIn: mine.checkIn?.toISOString() ?? null,
        checkOut: mine.checkOut?.toISOString() ?? null,
      };
    } else {
      myAttendance = { status: 'ABSENT', checkIn: null, checkOut: null };
    }
  }

  const hasSalesActivityToday = myLeadsToday + myActivitiesToday > 0;

  return jsonOk({
    asOf: new Date().toISOString(),
    attendance: {
      present,
      late,
      onLeave,
      notArrived,
      workingNow,
      attendancePercent,
      rosterSize,
      lateList: lateList.slice(0, 8),
      onLeaveList: onLeaveList.slice(0, 8),
    },
    me: {
      name: session.user?.name ?? 'there',
      hasEmployeeProfile: !!employeeId,
      punchedIn: !!myAttendance?.checkIn,
      punchedOut: !!myAttendance?.checkOut,
      checkIn: myAttendance?.checkIn ?? null,
      checkOut: myAttendance?.checkOut ?? null,
    },
    dailyEntry: {
      hasSalesActivityToday,
      leadsCreatedToday: myLeadsToday,
      activitiesToday: myActivitiesToday,
    },
  });
});
