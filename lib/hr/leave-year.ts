import { prisma } from '@/lib/prisma'
import { ensureEmployeeLeaveBalances, ensureLeavePolicies } from '@/lib/hr/leave-service'

/** Year-end leave carry-forward using policy.carryForwardMax. */
export async function carryForwardLeaveBalances(
  companyId: string,
  fromYear: number,
  toYear = fromYear + 1
) {
  const policies = await ensureLeavePolicies(companyId)
  const employees = await prisma.employee.findMany({
    where: { companyId, isApproved: true, status: { not: 'TERMINATED' } },
    select: { id: true },
  })

  let updated = 0
  for (const emp of employees) {
    await ensureEmployeeLeaveBalances(emp.id, companyId, toYear)
    for (const policy of policies) {
      const prev = await prisma.leaveBalance.findUnique({
        where: {
          employeeId_policyId_year: {
            employeeId: emp.id,
            policyId: policy.id,
            year: fromYear,
          },
        },
      })
      if (!prev) continue
      const remaining = Math.max(0, prev.entitled - prev.used)
      const carried = Math.min(remaining, policy.carryForwardMax)
      if (carried <= 0) continue
      await prisma.leaveBalance.update({
        where: {
          employeeId_policyId_year: {
            employeeId: emp.id,
            policyId: policy.id,
            year: toYear,
          },
        },
        data: {
          entitled: policy.daysPerYear + carried,
        },
      })
      updated++
    }
  }
  return { employees: employees.length, balancesUpdated: updated }
}

/** Grant comp-off days (policy code CO) for overtime. */
export async function grantCompOff(
  employeeId: string,
  companyId: string,
  days: number,
  year = new Date().getFullYear()
) {
  const policies = await ensureLeavePolicies(companyId)
  let co = policies.find((p) => p.code.toUpperCase() === 'CO')
  if (!co) {
    co = await prisma.leavePolicy.create({
      data: {
        companyId,
        name: 'Comp Off',
        code: 'CO',
        daysPerYear: 0,
        carryForwardMax: 5,
        isPaid: true,
        active: true,
      },
    })
  }
  await ensureEmployeeLeaveBalances(employeeId, companyId, year)
  return prisma.leaveBalance.update({
    where: {
      employeeId_policyId_year: {
        employeeId,
        policyId: co.id,
        year,
      },
    },
    data: { entitled: { increment: days } },
  })
}

export function attendanceDateOnly(d = new Date()): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}
