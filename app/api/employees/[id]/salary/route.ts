import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { handleRouteError } from '@/lib/api/tenant-response';
import { prisma } from '@/lib/prisma'
import { hasLegacyRole } from '@/lib/auth/permissions'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }
    // Salary is HR-admin only (employees see their own pay via payslips)
    if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req)
    const employeeId = (await params).id

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    })
    if (!employee) {
      return new Response('Not found', { status: 404 })
    }

    const salary = await prisma.employeeSalary.findFirst({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
      select: {
        id: true,
        basicSalary: true,
        houseRent: true,
        transport: true,
        medicalAllowance: true,
        taxDeduction: true,
        otherDeductions: true,
        effectiveFrom: true,
      },
    })

    return new Response(JSON.stringify(salary), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof TenantError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    console.error('Salary fetch error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }
    // Salary is HR-admin only (employees see their own pay via payslips)
    if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req)
    const data = await req.json().catch(() => ({}))
    const employeeId = (await params).id

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    })

    if (!employee) {
      return new Response('Employee not found', { status: 404 })
    }

    const amount = (v: unknown) => (v === undefined || v === null || v === '' ? 0 : Number(v))
    const fields = {
      basicSalary: amount(data.basicSalary),
      houseRent: amount(data.houseRent),
      transport: amount(data.transport),
      medicalAllowance: amount(data.medicalAllowance),
      taxDeduction: amount(data.taxDeduction),
      otherDeductions: amount(data.otherDeductions),
    }
    if (
      !(fields.basicSalary > 0) ||
      Object.values(fields).some((n) => !Number.isFinite(n) || n < 0)
    ) {
      return new Response(
        JSON.stringify({ error: 'basicSalary must be positive and amounts non-negative numbers' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const salary = await prisma.employeeSalary.create({
      data: {
        employee: { connect: { id: employeeId } },
        createdBy: { connect: { id: session.user.id } },
        ...fields,
        effectiveFrom: new Date(),
      },
    })

    const { logEmployeeActivity } = await import('@/lib/hr/activity')
    await logEmployeeActivity({
      employeeId,
      actorId: session.user.employeeId,
      type: 'SALARY_UPDATE',
      message: 'Salary structure updated',
      meta: { salaryId: salary.id },
    })

    return new Response(JSON.stringify(salary), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof TenantError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    console.error('Salary creation error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
