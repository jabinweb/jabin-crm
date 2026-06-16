import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { CompanyTaskStatus } from '@prisma/client'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.employeeId) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const employee = await prisma.employee.findUnique({
      where: {
        id: session.user.employeeId
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        leaveRequests: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        attendance: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        assignedTasks: {
          where: { status: CompanyTaskStatus.TODO },
          take: 5,
        },
      }
    })

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(employee)

  } catch (error) {
    console.error('Profile fetch error:', error)
    return NextResponse.json(
      { error: 'Error fetching profile' },
      { status: 500 }
    )
  }
}

