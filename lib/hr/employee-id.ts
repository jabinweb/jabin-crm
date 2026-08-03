import { prisma } from '@/lib/prisma'

type EmpDb = {
  employee: {
    findMany: (args: {
      where: { companyId: string }
      select: { employeeId: true }
    }) => Promise<{ employeeId: string }[]>
  }
}

/** Sequential human-readable ID per company: EMP-0001, EMP-0002, … */
export async function nextEmployeeCode(
  companyId: string,
  db: EmpDb = prisma
): Promise<string> {
  const employees = await db.employee.findMany({
    where: { companyId },
    select: { employeeId: true },
  })

  let max = 0
  for (const e of employees) {
    const m = /^EMP-(\d+)$/i.exec(e.employeeId.trim())
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }

  return `EMP-${String(max + 1).padStart(4, '0')}`
}

/** Sync denormalized department/jobTitle strings from org FKs. */
export async function resolveOrgLabels(input: {
  departmentId?: string | null
  designationId?: string | null
  department?: string
  jobTitle?: string
}) {
  let department = input.department
  let jobTitle = input.jobTitle

  if (input.departmentId) {
    const d = await prisma.hrDepartment.findUnique({
      where: { id: input.departmentId },
      select: { name: true },
    })
    if (d) department = d.name
  }
  if (input.designationId) {
    const d = await prisma.hrDesignation.findUnique({
      where: { id: input.designationId },
      select: { name: true },
    })
    if (d) jobTitle = d.name
  }

  return { department, jobTitle }
}
