import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { createPayrollPayment } from '@/lib/razorpay'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'

/** Create Razorpay order for a payslip. Payslip is marked paid via POST /api/webhooks/razorpay (payment.captured). */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = (session.user as { role?: string }).role
    if (!role || !['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { payslipId } = await req.json()
    if (!payslipId) {
      return NextResponse.json({ error: 'payslipId required' }, { status: 400 })
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req)

    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      include: {
        employee: {
          select: {
            name: true,
            email: true,
            companyId: true,
          },
        },
      },
    })

    if (!payslip || payslip.employee.companyId !== companyId) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 })
    }

    if (payslip.isPaid) {
      return NextResponse.json({ error: 'Payslip already paid' }, { status: 400 })
    }

    const order = await createPayrollPayment({
      employeeId: payslip.employeeId,
      companyId: payslip.employee.companyId,
      amount: payslip.netSalary,
      currency: 'INR',
      description: `Salary payment for ${payslip.employee.name} - ${payslip.month}/${payslip.year}`,
      payslipId: payslip.id,
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      message:
        'Razorpay order created. Payslip is marked paid when payment.captured webhook fires (notes.payslipId).',
      order,
    })
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[API] Process payroll error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to initiate payment. Enable company payroll Razorpay in settings.',
      },
      { status: 500 }
    )
  }
}

