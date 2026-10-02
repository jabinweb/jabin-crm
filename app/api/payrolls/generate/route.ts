import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { EmployeeStatus } from '@prisma/client'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'
import { PayrollService } from '@/lib/services/payroll-service'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = (session.user as { role?: string }).role
    if (!role || !['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { companyId, employeeId } = body
    const month = Number(body.month)
    const year = Number(body.year)

    if (!companyId || !month || !year) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 })
    }

    if (role !== 'SUPER_ADMIN') {
      const ctx = await resolveCompanyContextFromRequest(session, req)
      if (ctx.companyId !== companyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (typeof employeeId === 'string' && employeeId) {
      const emp = await prisma.employee.findFirst({
        where: { id: employeeId, companyId, status: EmployeeStatus.ACTIVE },
        select: { id: true },
      })
      if (!emp) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
      }
      const payslip = await PayrollService.generatePayslip(employeeId, month, year)
      return NextResponse.json({
        success: true,
        message: 'Generated 1 payslip',
        data: [payslip],
      })
    }

    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        status: EmployeeStatus.ACTIVE,
        isApproved: true,
      },
      select: { id: true },
    })

    type PayslipRow = Awaited<ReturnType<typeof PayrollService.generatePayslip>>
    const payslips: PayslipRow[] = []
    for (const employee of employees) {
      try {
        const existing = await prisma.payslip.findFirst({
          where: { employeeId: employee.id, month, year },
        })
        if (existing) continue
        payslips.push(await PayrollService.generatePayslip(employee.id, month, year))
      } catch (err) {
        console.warn(`[payroll] skip ${employee.id}:`, err instanceof Error ? err.message : err)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${payslips.length} payslips`,
      data: payslips,
    })
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const status = (error as { status?: number })?.status
    if (status && status >= 400 && status < 500) {
      return NextResponse.json({ error: (error as Error).message }, { status })
    }
    if (error instanceof Error && error.message === 'No salary configuration found') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Bulk payroll generation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate payslips',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}
