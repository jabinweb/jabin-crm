import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { attendanceDateOnly } from '@/lib/hr/leave-year';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.employeeId) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Same calendar-day key check-in/check-out use (HR timezone, not server-local).
    const attendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: session.user.employeeId,
          date: attendanceDateOnly(),
        },
      },
    });

    if (!attendance) {
      return new Response(JSON.stringify({
        status: 'ABSENT',
        checkIn: null,
        checkOut: null,
        createdAt: null
      }), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify(attendance), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[API] Get today attendance error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

