import { NextResponse } from "next/server"
import { auth } from '@/auth'
import { prisma } from "@/lib/prisma"
import { AttendanceStatus } from "@prisma/client"
import { randomUUID } from 'crypto' // Add this import
import { attendanceDateOnly } from '@/lib/hr/leave-year'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const today = attendanceDateOnly()
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    const attendance = await prisma.attendance.findMany({
      where: {
        employeeId: session.user.employeeId,
        // Whole current month (HR-timezone calendar days), not from "now" on the 1st.
        date: { gte: monthStart, lte: today },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(attendance)
  } catch (error) {
    console.error("Error fetching attendance:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.employeeId) {
      console.log('No employeeId in session:', session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { action } = await request.json()
    console.log('Action:', action)
    
    const now = new Date()

    // Today's row, keyed the same way as the unique (employeeId, date) constraint
    let attendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: session.user.employeeId,
          date: attendanceDateOnly(now),
        },
      },
    })

    console.log('Existing attendance for today:', attendance)

    // Also check for any unclosed attendance from previous days
    const unclosedAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: session.user.employeeId,
        checkIn: { not: null },
        checkOut: null,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log('Unclosed attendance from previous days:', unclosedAttendance)

    if (action === 'clockIn') {
      // Check if user already clocked in today
      if (attendance?.checkIn) {
        console.log('User already clocked in today')
        return NextResponse.json(
          { error: "Already clocked in today" },
          { status: 400 }
        )
      }

      // If there's an unclosed attendance from a previous day, auto-close it first
      if (unclosedAttendance && !attendance) {
        console.log('Auto-closing previous day attendance:', unclosedAttendance.id)
        await prisma.attendance.update({
          where: { id: unclosedAttendance.id },
          data: { 
            checkOut: new Date(unclosedAttendance.createdAt.getTime() + 8 * 60 * 60 * 1000) // Auto checkout 8 hours after checkin
          },
        })
      }

      attendance = attendance
        ? await prisma.attendance.update({
            where: { id: attendance.id },
            data: { checkIn: now, status: AttendanceStatus.PRESENT },
          })
        : await prisma.attendance.create({
            data: {
              id: randomUUID(),
              employeeId: session.user.employeeId,
              date: attendanceDateOnly(now),
              checkIn: now,
              status: AttendanceStatus.PRESENT,
            },
          })
      console.log('Created attendance:', attendance)
    } else if (action === 'clockOut') {
      // For clock out, use today's attendance or the most recent unclosed one
      const attendanceToUpdate = attendance || unclosedAttendance
      
      if (!attendanceToUpdate) {
        console.log('No attendance record found for clock out')
        return NextResponse.json(
          { error: "No clock-in record found" },
          { status: 400 }
        )
      }

      if (attendanceToUpdate.checkOut) {
        console.log('User already clocked out')
        return NextResponse.json(
          { error: "Already clocked out" },
          { status: 400 }
        )
      }

      console.log('Updating attendance for clock out:', attendanceToUpdate.id)
      attendance = await prisma.attendance.update({
        where: { id: attendanceToUpdate.id },
        data: { checkOut: now },
      })
      console.log('Updated attendance:', attendance)
    } else {
      console.log('Invalid action:', action)
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      )
    }

    return NextResponse.json(attendance)
  } catch (error) {
    console.error("Error updating attendance:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

