import { prisma } from '@/lib/prisma'
import { AttendanceStatus } from '@prisma/client'

function parseHm(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(':').map((x) => parseInt(x, 10))
  return { h: h || 0, m: m || 0 }
}

/**
 * Wall-clock timezone for HR punches. Shift times like "09:00" are local to the
 * workforce, not the server (which usually runs in UTC).
 */
export const HR_TIME_ZONE = process.env.HR_TIMEZONE || 'Asia/Kolkata'

/** Calendar date and time-of-day of `d` in the HR timezone. */
export function hrZonedParts(d: Date): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HR_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10) || 0
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
  }
}

/** Minutes since midnight in the HR timezone. */
export function minutesSinceMidnight(d: Date): number {
  const { hour, minute } = hrZonedParts(d)
  return hour * 60 + minute
}

export async function getActiveShiftForEmployee(employeeId: string, at = new Date()) {
  const assignment = await prisma.employeeShiftAssignment.findFirst({
    where: {
      employeeId,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    include: { shift: true },
  })
  return assignment?.shift || null
}

export function evaluateCheckInStatus(
  checkIn: Date,
  shift: { startTime: string; graceMinutes: number } | null
): AttendanceStatus {
  if (!shift) return AttendanceStatus.PRESENT
  const start = parseHm(shift.startTime)
  const startMins = start.h * 60 + start.m
  const actual = minutesSinceMidnight(checkIn)
  if (actual > startMins + shift.graceMinutes) return AttendanceStatus.LATE
  return AttendanceStatus.PRESENT
}

export function evaluateCheckOut(
  checkIn: Date,
  checkOut: Date,
  shift: { endTime: string; startTime: string } | null
): { overtimeMinutes: number; earlyDeparture: boolean } {
  if (!shift) {
    const worked = Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000)
    return { overtimeMinutes: Math.max(0, worked - 480), earlyDeparture: false }
  }
  const end = parseHm(shift.endTime)
  const endMins = end.h * 60 + end.m
  const outMins = minutesSinceMidnight(checkOut)
  const earlyDeparture = outMins + 5 < endMins
  const overtimeMinutes = Math.max(0, outMins - endMins)
  return { overtimeMinutes, earlyDeparture }
}
