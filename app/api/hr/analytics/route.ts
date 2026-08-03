import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isHrAdminResult, requireHrAdmin } from '@/lib/hr/api-auth'

export async function GET(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const companyId = ctx.companyId
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))

    const [
      headcount,
      active,
      terminated,
      attendanceMonth,
      leavePending,
      leaveUsed,
      payrollCost,
      openTickets,
    ] = await Promise.all([
      prisma.employee.count({ where: { companyId } }),
      prisma.employee.count({ where: { companyId, status: 'ACTIVE' } }),
      prisma.employee.count({ where: { companyId, status: 'TERMINATED' } }),
      prisma.attendance.count({
        where: {
          date: { gte: monthStart },
          employee: { companyId },
          status: { in: ['PRESENT', 'LATE'] },
        },
      }),
      prisma.leaveRequest.count({
        where: { status: 'PENDING', employee: { companyId } },
      }),
      prisma.leaveBalance.aggregate({
        where: { employee: { companyId }, year: now.getFullYear() },
        _sum: { used: true, entitled: true },
      }),
      prisma.payslip.aggregate({
        where: {
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          employee: { companyId },
        },
        _sum: { netSalary: true },
      }),
      prisma.hrTicket.count({ where: { companyId, status: 'OPEN' } }),
    ])

    const entitled = leaveUsed._sum.entitled || 0
    const used = leaveUsed._sum.used || 0

    return NextResponse.json({
      headcount,
      active,
      attritionApprox: headcount > 0 ? terminated / headcount : 0,
      attendancePunchesThisMonth: attendanceMonth,
      leavePending,
      leaveUtilization: entitled > 0 ? used / entitled : 0,
      payrollCostThisMonth: payrollCost._sum.netSalary || 0,
      openHrTickets: openTickets,
    })
  } catch (e) {
    console.error('[hr analytics]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
