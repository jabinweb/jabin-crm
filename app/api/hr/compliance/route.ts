import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isHrAdminResult, requireHrAdmin } from '@/lib/hr/api-auth'

export async function GET(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const url = new URL(request.url)
    const month = Number(url.searchParams.get('month')) || new Date().getMonth() + 1
    const year = Number(url.searchParams.get('year')) || new Date().getFullYear()
    const format = url.searchParams.get('format')

    const payslips = await prisma.payslip.findMany({
      where: {
        month,
        year,
        employee: { companyId: ctx.companyId },
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            statutoryProfile: true,
          },
        },
      },
      orderBy: { employee: { name: 'asc' } },
    })

    if (format === 'bank-csv') {
      const header = 'employeeId,name,netSalary,isPaid\n'
      const rows = payslips
        .map(
          (p) =>
            `${p.employee.employeeId},"${p.employee.name}",${p.netSalary},${p.isPaid}`
        )
        .join('\n')
      return new NextResponse(header + rows, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="bank-advice-${year}-${month}.csv"`,
        },
      })
    }

    if (format === 'pf-csv') {
      const header = 'employeeId,name,uan,pfNumber,employeePF,employerPF,basic\n'
      const rows = payslips
        .map((p) => {
          const b = (p.breakdown || {}) as {
            components?: { deductions?: { pf?: number }; employer?: { pf?: number }; basic?: number }
            statutory?: { uan?: string; pfNumber?: string }
          }
          return `${p.employee.employeeId},"${p.employee.name}",${
            p.employee.statutoryProfile?.uan || b.statutory?.uan || ''
          },${p.employee.statutoryProfile?.pfNumber || ''},${
            b.components?.deductions?.pf ?? 0
          },${b.components?.employer?.pf ?? 0},${b.components?.basic ?? p.basicSalary}`
        })
        .join('\n')
      return new NextResponse(header + rows, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="pf-register-${year}-${month}.csv"`,
        },
      })
    }

    if (format === 'esi-csv') {
      const header = 'employeeId,name,esiNumber,employeeESI,employerESI,grossLike\n'
      const rows = payslips
        .map((p) => {
          const b = (p.breakdown || {}) as {
            components?: { deductions?: { esi?: number }; employer?: { esi?: number } }
          }
          return `${p.employee.employeeId},"${p.employee.name}",${
            p.employee.statutoryProfile?.esiNumber || ''
          },${b.components?.deductions?.esi ?? 0},${b.components?.employer?.esi ?? 0},${
            p.basicSalary + p.additions
          }`
        })
        .join('\n')
      return new NextResponse(header + rows, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="esi-register-${year}-${month}.csv"`,
        },
      })
    }

    return NextResponse.json({ month, year, payslips })
  } catch (e) {
    console.error('[compliance]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
