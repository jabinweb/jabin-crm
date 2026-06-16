import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { allowManualPayrollMarkPaid } from '@/lib/env-validation';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';

/** Staging-only: mark payslip paid without Razorpay (set ALLOW_MANUAL_PAYROLL_MARK_PAID=true). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!allowManualPayrollMarkPaid()) {
      return NextResponse.json(
        {
          error:
            'Manual payroll mark-paid is disabled. Use Razorpay payment + webhook, or set ALLOW_MANUAL_PAYROLL_MARK_PAID=true in staging.',
        },
        { status: 403 }
      );
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { companyId } = await resolveCompanyContextFromRequest(session, req);

    const payslip = await prisma.payslip.findUnique({
      where: { id },
      include: { employee: { select: { companyId: true } } },
    });

    if (!payslip || payslip.employee.companyId !== companyId) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    if (payslip.isPaid) {
      return NextResponse.json({ success: true, message: 'Already marked paid' });
    }

    const updated = await prisma.payslip.update({
      where: { id },
      data: { isPaid: true, paidAt: new Date() },
    });

    return NextResponse.json({ success: true, payslip: updated });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[payrolls/mark-paid]', error);
    return NextResponse.json({ error: 'Failed to mark payslip paid' }, { status: 500 });
  }
}
