import { prisma } from '@/lib/prisma'
import {
  calcESI,
  calcPF,
  calcPT,
  calcTDS,
  parsePtBandsFromSettings,
} from '@/lib/hr/india-statutory'

export class PayrollService {
  /** `month` is 1–12 from the UI. */
  static async calculateSalary(employeeId: string, month: number, year: number) {
    const monthIndex = month - 1

    const salary = await prisma.employeeSalary.findFirst({
      where: {
        employeeId,
        effectiveFrom: {
          lte: new Date(year, monthIndex + 1, 0, 23, 59, 59),
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    })

    if (!salary) throw new Error('No salary configuration found')

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true, name: true, employeeId: true },
    })

    const company = employee?.companyId
      ? await prisma.company.findUnique({
          where: { id: employee.companyId },
          select: { settings: true },
        })
      : null
    const ptBands = parsePtBandsFromSettings(company?.settings)

    const attendance = await prisma.attendance.findMany({
      where: {
        employeeId,
        date: {
          gte: new Date(Date.UTC(year, monthIndex, 1)),
          lt: new Date(Date.UTC(year, monthIndex + 1, 1)),
        },
      },
    })

    const statutory = await prisma.statutoryProfile.findUnique({
      where: { employeeId },
    })

    const workingDays = this.getWorkingDays(monthIndex, year)
    const presentDays = attendance.filter(
      (a) => a.status === 'PRESENT' || a.status === 'LATE'
    ).length
    const halfDays = attendance.filter((a) => a.status === 'HALF_DAY').length

    // Approved paid leave and company holidays on working days are paid, not LOP.
    // Days that already have a PRESENT/LATE/HALF_DAY punch are not counted twice.
    const monthStartUtc = new Date(Date.UTC(year, monthIndex, 1))
    const monthEndUtc = new Date(Date.UTC(year, monthIndex + 1, 0))
    const dayKey = (d: Date) => d.toISOString().slice(0, 10)
    const workedKeys = new Set(
      attendance
        .filter((a) => a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'HALF_DAY')
        .map((a) => dayKey(a.date))
    )
    const paidDayKeys = new Set<string>()
    const addPaidRange = (from: Date, to: Date) => {
      const cur = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
      )
      const last = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()))
      while (cur <= last) {
        const dow = cur.getUTCDay()
        if (
          cur >= monthStartUtc &&
          cur <= monthEndUtc &&
          dow !== 0 &&
          dow !== 6 &&
          !workedKeys.has(dayKey(cur))
        ) {
          paidDayKeys.add(dayKey(cur))
        }
        cur.setUTCDate(cur.getUTCDate() + 1)
      }
    }
    const [paidLeaves, holidays] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          startDate: { lt: new Date(Date.UTC(year, monthIndex + 1, 1)) },
          endDate: { gte: monthStartUtc },
          OR: [{ policyId: null }, { policy: { isPaid: true } }],
        },
        select: { startDate: true, endDate: true },
      }),
      employee?.companyId
        ? prisma.companyHoliday.findMany({
            where: {
              companyId: employee.companyId,
              date: { gte: monthStartUtc, lt: new Date(Date.UTC(year, monthIndex + 1, 1)) },
            },
            select: { date: true },
          })
        : Promise.resolve([] as { date: Date }[]),
    ])
    for (const l of paidLeaves) addPaidRange(l.startDate, l.endDate)
    for (const h of holidays) addPaidRange(h.date, h.date)

    const presentEquivalent = presentDays + halfDays * 0.5 + paidDayKeys.size
    const attendanceRate =
      workingDays > 0 ? Math.min(1, presentEquivalent / workingDays) : 0

    const overtimeMinutes = attendance.reduce((sum, a) => sum + (a.overtime || 0), 0)
    const hourlyRate = salary.basicSalary / (workingDays * 8 || 1)
    const overtimePay = Math.round((overtimeMinutes / 60) * hourlyRate * 1.5)

    const basic = Math.round(salary.basicSalary * attendanceRate * 100) / 100
    const houseRent = salary.houseRent
    const transport = salary.transport
    const medical = salary.medicalAllowance
    const grossBeforeOt = basic + houseRent + transport + medical
    const gross = grossBeforeOt + overtimePay

    const pf = calcPF(basic, statutory?.pfEnabled !== false)
    const esi = calcESI(gross, statutory?.esiEnabled !== false)
    const pt = calcPT(gross, statutory?.ptEnabled !== false, ptBands)
    const tdsResult = calcTDS(
      gross - pf.employee - esi.employee - pt,
      salary.taxDeduction
    )
    const tds = tdsResult.amount

    const attendanceDeduction = Math.round((salary.basicSalary - basic) * 100) / 100
    const other = salary.otherDeductions
    const statutoryEmployee = pf.employee + esi.employee + pt + tds

    // `basic` is already pro-rated by attendance; `attendanceDeduction` is the LOP amount
    // shown on the slip for information and must not be subtracted a second time.
    const total = gross - statutoryEmployee - other

    return {
      employee,
      components: {
        basic,
        houseRent,
        transport,
        medical,
        overtimePay,
        deductions: {
          tax: tds,
          taxEstimated: tdsResult.estimated,
          other,
          attendance: attendanceDeduction,
          pf: pf.employee,
          esi: esi.employee,
          pt,
        },
        employer: {
          pf: pf.employer,
          esi: esi.employer,
        },
      },
      total: Math.max(0, Math.round(total)),
      attendance: {
        workingDays,
        presentDays: presentEquivalent,
        rate: attendanceRate,
        overtimeMinutes,
      },
      statutory: {
        pfEnabled: statutory?.pfEnabled !== false,
        esiEnabled: statutory?.esiEnabled !== false,
        ptEnabled: statutory?.ptEnabled !== false,
        pan: statutory?.pan,
        uan: statutory?.uan,
        pfNumber: statutory?.pfNumber,
        esiNumber: statutory?.esiNumber,
      },
    }
  }

  static async generatePayslip(employeeId: string, month: number, year: number) {
    const existing = await prisma.payslip.findUnique({
      where: { employeeId_month_year: { employeeId, month, year } },
      select: { isPaid: true },
    })
    if (existing?.isPaid) {
      throw Object.assign(new Error('Payslip already paid; it cannot be regenerated'), {
        status: 409,
      })
    }

    const calculation = await this.calculateSalary(employeeId, month, year)
    // Attendance (LOP) is already reflected in the pro-rated basic, so it is not a deduction here.
    const deductions =
      calculation.components.deductions.tax +
      calculation.components.deductions.other +
      calculation.components.deductions.pf +
      calculation.components.deductions.esi +
      calculation.components.deductions.pt
    const additions =
      calculation.components.houseRent +
      calculation.components.transport +
      calculation.components.medical +
      calculation.components.overtimePay

    return prisma.payslip.upsert({
      where: {
        employeeId_month_year: { employeeId, month, year },
      },
      create: {
        employeeId,
        month,
        year,
        basicSalary: calculation.components.basic,
        deductions,
        additions,
        netSalary: calculation.total,
        breakdown: calculation as object,
        isPaid: false,
      },
      update: {
        basicSalary: calculation.components.basic,
        deductions,
        additions,
        netSalary: calculation.total,
        breakdown: calculation as object,
      },
    })
  }

  private static getWorkingDays(monthIndex: number, year: number): number {
    const date = new Date(year, monthIndex, 1)
    let workingDays = 0
    while (date.getMonth() === monthIndex) {
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        workingDays++
      }
      date.setDate(date.getDate() + 1)
    }
    return workingDays || 1
  }
}
