import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth } from 'date-fns';
import type { Prisma } from '@prisma/client';

type AttendanceReportRow = Prisma.AttendanceGetPayload<{
  include: { employee: { select: { name: true; employeeId: true } } };
}>;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.employeeId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');
    const now = new Date();
    const month =
      monthParam !== null && monthParam !== ''
        ? Number.parseInt(monthParam, 10)
        : now.getMonth() + 1;
    const year =
      yearParam !== null && yearParam !== ''
        ? Number.parseInt(yearParam, 10)
        : now.getFullYear();

    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return new Response(JSON.stringify({ error: 'Invalid month' }), { status: 400 });
    }
    if (!Number.isFinite(year) || year < 1970 || year > 2100) {
      return new Response(JSON.stringify({ error: 'Invalid year' }), { status: 400 });
    }

    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    const records = (await prisma.attendance.findMany({
      where: {
        employeeId: session.user.employeeId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        employee: {
          select: {
            name: true,
            employeeId: true,
          },
        },
      },
    })) as AttendanceReportRow[];

    // Calculate statistics
    const stats = {
      totalDays: records.length,
      presentDays: records.filter((r: AttendanceReportRow) => r.status === 'PRESENT').length,
      lateDays: records.filter((r: AttendanceReportRow) => r.status === 'LATE').length,
      absentDays: records.filter((r: AttendanceReportRow) => r.status === 'ABSENT').length,
      halfDays: records.filter((r: AttendanceReportRow) => r.status === 'HALF_DAY').length,
      onLeaveDays: records.filter((r: AttendanceReportRow) => r.status === 'ON_LEAVE').length,
      totalOvertime: records.reduce(
        (acc: number, curr: AttendanceReportRow) => acc + (curr.overtime || 0),
        0
      ),
      averageCheckIn: calculateAverageTime(records.map((r: AttendanceReportRow) => r.checkIn)),
      averageCheckOut: calculateAverageTime(records.map((r: AttendanceReportRow) => r.checkOut)),
      records: records.map(formatAttendanceRecord),
    };

    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[API] Attendance report error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}

function calculateAverageTime(dates: (Date | null)[]): string | null {
  const validDates = dates.filter((d): d is Date => d !== null);
  if (validDates.length === 0) return null;

  const totalMinutes = validDates.reduce((acc, date) => {
    return acc + date.getHours() * 60 + date.getMinutes();
  }, 0);

  const avgMinutes = Math.round(totalMinutes / validDates.length);
  const hours = Math.floor(avgMinutes / 60);
  const minutes = avgMinutes % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function formatAttendanceRecord(record: AttendanceReportRow) {
  const notes =
    record.metadata &&
    typeof record.metadata === 'object' &&
    !Array.isArray(record.metadata) &&
    'notes' in record.metadata
      ? (record.metadata as { notes?: unknown }).notes
      : undefined;

  return {
    id: record.id,
    date: record.createdAt,
    status: record.status,
    checkIn: record.checkIn,
    checkOut: record.checkOut,
    overtime: record.overtime,
    notes,
  };
}

