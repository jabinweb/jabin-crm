import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
})

const emergencyContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  relation: z.string().optional(),
})

const patchSchema = z.object({
  phone: z.string().min(5).optional(),
  address: addressSchema.optional(),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  emergencyContact: emergencyContactSchema.nullable().optional(),
})

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.employeeId) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 })
    }

    const employee = await prisma.employee.findUnique({
      where: { id: session.user.employeeId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        leaveRequests: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        attendance: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const userId = employee.userId ?? session.user.id
    const openProjectTasks = userId
      ? await prisma.projectTask.findMany({
          where: {
            assigneeId: userId,
            status: { not: 'DONE' },
          },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            projectId: true,
          },
        })
      : []

    return NextResponse.json({
      ...employee,
      assignedTasks: openProjectTasks,
    })
  } catch (error) {
    console.error('Profile fetch error:', error)
    return NextResponse.json({ error: 'Error fetching profile' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data
    const update: Record<string, unknown> = {}

    if (data.phone !== undefined) update.phone = data.phone
    if (data.address !== undefined) update.address = data.address
    if (data.gender !== undefined) update.gender = data.gender
    if (data.emergencyContact !== undefined) {
      update.emergencyContact = data.emergencyContact
    }
    if (data.dateOfBirth !== undefined) {
      if (data.dateOfBirth === null || data.dateOfBirth === '') {
        update.dateOfBirth = null
      } else {
        update.dateOfBirth = new Date(data.dateOfBirth)
      }
    }

    const employee = await prisma.employee.update({
      where: { id: session.user.employeeId },
      data: update,
    })

    return NextResponse.json(employee)
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Error updating profile' }, { status: 500 })
  }
}
