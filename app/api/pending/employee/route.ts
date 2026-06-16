import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { EmployeeRole, EmployeeStatus, UserStatus } from '@prisma/client'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const session = await auth()
    if (!session?.user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const role = session.user.role
    if (!role || !['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return json({ error: 'Unauthorized' }, 401)
    }

    let companyId: string | undefined
    if (role !== 'SUPER_ADMIN') {
      const ctx = await resolveCompanyContextFromRequest(session, request)
      companyId = ctx.companyId
    }

    const pendingEmployees = await prisma.employee.findMany({
      where: {
        status: EmployeeStatus.PENDING,
        role: EmployeeRole.EMPLOYEE,
        ...(companyId ? { companyId } : {}),
      },
      include: {
        company: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return json(pendingEmployees)
  } catch (error) {
    if (error instanceof TenantError) {
      return json({ error: error.message }, error.status)
    }
    console.error('Error fetching pending employees:', error)
    return json({ error: 'Failed to fetch pending employees' }, 500)
  }
}

export async function PATCH(request: NextRequest): Promise<Response> {
  try {
    const session = await auth()
    if (!session?.user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const role = session.user.role
    if (!role || !['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const body = await request.json()
    const { id, action } = body as { id?: string; action?: string }

    if (!id || !action || !['approve', 'reject'].includes(action)) {
      return json({ error: 'Missing id or valid action (approve|reject)' }, 400)
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, companyId: true },
    })

    if (!employee) {
      return json({ error: 'Employee not found' }, 404)
    }

    if (role !== 'SUPER_ADMIN') {
      const { companyId } = await resolveCompanyContextFromRequest(session, request)
      if (employee.companyId !== companyId) {
        return json({ error: 'Forbidden' }, 403)
      }
    }

    const result = await prisma.employee.update({
      where: { id },
      data: {
        status: action === 'approve' ? EmployeeStatus.ACTIVE : EmployeeStatus.REJECTED,
        isApproved: action === 'approve',
        user: {
          update: {
            userStatus: action === 'approve' ? UserStatus.ACTIVE : UserStatus.REJECTED,
          },
        },
      },
      include: {
        company: true,
        user: true,
      },
    })

    return json(result)
  } catch (error) {
    if (error instanceof TenantError) {
      return json({ error: error.message }, error.status)
    }
    console.error('Error updating employee status:', error)
    return json({ error: 'Failed to update employee status' }, 500)
  }
}
