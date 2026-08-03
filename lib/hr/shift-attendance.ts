import { prisma } from '@/lib/prisma'
import { AttendanceStatus } from '@prisma/client'

function parseHm(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(':').map((x) => parseInt(x, 10))
  return { h: h || 0, m: m || 0 }
}

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
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
