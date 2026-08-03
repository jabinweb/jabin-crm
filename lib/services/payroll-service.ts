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
    const presentEquivalent = presentDays + halfDays * 0.5
    const attendanceRate = workingDays > 0 ? presentEquivalent / workingDays : 0

    const overtimeMinutes = attendance.reduce((sum, a) => sum + (a.overtime || 0), 0)
    const hourlyRate = salary.basicSalary / (workingDays * 8 || 1)
    const overtimePay = Math.round((overtimeMinutes / 60) * hourlyRate * 1.5)

    const basic = salary.basicSalary * attendanceRate
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

    const attendanceDeduction = salary.basicSalary * (1 - attendanceRate)
    const other = salary.otherDeductions
    const statutoryEmployee = pf.employee + esi.employee + pt + tds

    const total = gross - statutoryEmployee - other - attendanceDeduction

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
    const calculation = await this.calculateSalary(employeeId, month, year)
    const deductions =
      calculation.components.deductions.tax +
      calculation.components.deductions.other +
      calculation.components.deductions.attendance +
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
