import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { EmployeeStatus } from '@prisma/client'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, request)

    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        status: EmployeeStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        department: true,
        jobTitle: true,
        role: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(employees)
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error fetching employees:', error)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}
