import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isHrAdminResult, requireHrAdmin } from '@/lib/hr/api-auth'

/** Form 16 Part B–style annual summary from payslip history (not full IT engine). */
export async function GET(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const url = new URL(request.url)
    const employeeId = url.searchParams.get('employeeId')
    const year = Number(url.searchParams.get('year')) || new Date().getFullYear()
    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId required' }, { status: 400 })
    }

    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: ctx.companyId },
      include: { statutoryProfile: true },
    })
    if (!emp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const slips = await prisma.payslip.findMany({
      where: { employeeId, year },
      orderBy: { month: 'asc' },
    })

    let gross = 0
    let pf = 0
    let esi = 0
    let pt = 0
    let tds = 0
    let net = 0
    for (const s of slips) {
      gross += s.basicSalary + s.additions
      net += s.netSalary
      const b = (s.breakdown || {}) as {
        components?: {
          deductions?: { pf?: number; esi?: number; pt?: number; tax?: number }
        }
      }
      pf += b.components?.deductions?.pf ?? 0
      esi += b.components?.deductions?.esi ?? 0
      pt += b.components?.deductions?.pt ?? 0
      tds += b.components?.deductions?.tax ?? 0
    }

    return NextResponse.json({
      employee: {
        name: emp.name,
        employeeId: emp.employeeId,
        pan: emp.statutoryProfile?.pan,
        uan: emp.statutoryProfile?.uan,
      },
      year,
      months: slips.length,
      summary: { gross, pf, esi, pt, tds, net, deductions: gross - net },
      payslips: slips.map((s) => ({
        month: s.month,
        basicSalary: s.basicSalary,
        additions: s.additions,
        deductions: s.deductions,
        netSalary: s.netSalary,
      })),
    })
  } catch (e) {
    console.error('[form16]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
