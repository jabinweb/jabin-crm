import { prisma } from '@/lib/prisma';

const DEFAULT_POLICIES = [
  { name: 'Annual Leave', code: 'ANNUAL', daysPerYear: 12, carryForwardMax: 5 },
  { name: 'Sick Leave', code: 'SICK', daysPerYear: 6, carryForwardMax: 0 },
  { name: 'Casual Leave', code: 'CASUAL', daysPerYear: 6, carryForwardMax: 0 },
] as const;

export function leaveDaysBetween(start: Date, end: Date): number {
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const ms = e.getTime() - s.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

export async function ensureLeavePolicies(companyId: string) {
  const existing = await prisma.leavePolicy.count({ where: { companyId } });
  if (existing > 0) {
    return prisma.leavePolicy.findMany({
      where: { companyId, active: true },
      orderBy: { name: 'asc' },
    });
  }

  await prisma.leavePolicy.createMany({
    data: DEFAULT_POLICIES.map((p) => ({
      companyId,
      name: p.name,
      code: p.code,
      daysPerYear: p.daysPerYear,
      carryForwardMax: p.carryForwardMax,
      isPaid: true,
      active: true,
    })),
  });

  return prisma.leavePolicy.findMany({
    where: { companyId, active: true },
    orderBy: { name: 'asc' },
  });
}

export async function ensureEmployeeLeaveBalances(
  employeeId: string,
  companyId: string,
  year = new Date().getFullYear()
) {
  const policies = await ensureLeavePolicies(companyId);
  for (const policy of policies) {
    await prisma.leaveBalance.upsert({
      where: {
        employeeId_policyId_year: {
          employeeId,
          policyId: policy.id,
          year,
        },
      },
      create: {
        employeeId,
        policyId: policy.id,
        year,
        entitled: policy.daysPerYear,
        used: 0,
        pending: 0,
      },
      update: {},
    });
  }

  return prisma.leaveBalance.findMany({
    where: { employeeId, year },
    include: { policy: true },
    orderBy: { policy: { name: 'asc' } },
  });
}

export async function findPolicyByTypeOrCode(
  companyId: string,
  typeOrCode: string
) {
  const policies = await ensureLeavePolicies(companyId);
  const needle = typeOrCode.trim().toUpperCase();
  return (
    policies.find((p) => p.code.toUpperCase() === needle) ||
    policies.find((p) => p.name.toUpperCase() === needle) ||
    policies.find((p) => p.name.toUpperCase().includes(needle)) ||
    policies[0] ||
    null
  );
}
