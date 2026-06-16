import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { AttendanceStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.employeeId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { location, notes } = await req.json();
    const now = new Date();

    // Check if already checked in today
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: session.user.employeeId,
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        }
      }
    });

    if (existingAttendance?.checkIn) {
      return new Response(JSON.stringify({ error: 'Already checked in' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const meta: Prisma.InputJsonObject = {
      ...(location != null && { location }),
      ...(notes != null && { notes }),
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

    return new Response(JSON.stringify(attendance), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[API] Check-in error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

