import { handleRouteError } from '@/lib/api/tenant-response';
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as { role?: string }).role
    if (!role || !['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req)
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    const payslips = await prisma.payslip.findMany({
      where: {
        employee: { companyId },
        ...(month ? { month: parseInt(month, 10) } : {}),
        ...(year ? { year: parseInt(year, 10) } : {}),
      },
      include: {
        employee: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(payslips)
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Payroll list error:', error)
    return NextResponse.json({ error: 'Failed to fetch payslips' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!(session?.user as any)?.role || !['ADMIN', 'SUPER_ADMIN'].includes((session?.user as any).role)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { employeeId, month, year } = await req.json()

    // Get employee's salary configuration
    const salaryConfig = await prisma.employeeSalary.findFirst({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' }
    })

    if (!salaryConfig) {
      return new Response(JSON.stringify({ error: 'No salary configuration found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Calculate salary components
    const basicSalary = salaryConfig.basicSalary
    const additions = salaryConfig.houseRent + salaryConfig.transport + salaryConfig.medicalAllowance
    const deductions = salaryConfig.taxDeduction + salaryConfig.otherDeductions
    const netSalary = basicSalary + additions - deductions

    // Create payslip with required fields
    const payslip = await prisma.payslip.create({
      data: {
        employeeId,
        month,
        year,
        basicSalary,
        additions,
        deductions,
        netSalary,
        isPaid: false,
      },
      include: {
        employee: true,
      },
    })

    return new Response(JSON.stringify({ success: true, data: payslip }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Payroll generation error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate payslip',
      details: error instanceof Error ? error.message : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

