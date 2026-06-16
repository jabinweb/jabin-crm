import { NextRequest, NextResponse } from "next/server"
import { auth } from '@/auth'
import { prisma } from "@/lib/prisma"
import "@/types/auth"
import type { Prisma } from "@prisma/client"
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from "@/lib/auth/company-membership"

type DepartmentRow = Prisma.EmployeeGetPayload<{ select: { department: true } }>
type StatusRow = Prisma.EmployeeGetPayload<{ select: { status: true } }>

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, request)

    const [departments, statuses] = (await Promise.all([
      prisma.employee.findMany({
        where: { companyId },
        select: { department: true },
        distinct: ['department'],
      }),
      prisma.employee.findMany({
        where: { companyId },
        select: { status: true },
        distinct: ['status'],
      }),
    ])) as [DepartmentRow[], StatusRow[]]

    const metadata = {
      departments: departments.map((d: DepartmentRow) => ({
        label: d.department,
        value: d.department,
      })),
      statuses: statuses.map((s: StatusRow) => ({
        label: String(s.status).replace(/_/g, ' '),
        value: s.status,
      })),
      employmentTypes: [
        { label: 'Full Time', value: 'FULL_TIME' },
        { label: 'Part Time', value: 'PART_TIME' },
        { label: 'Contract', value: 'CONTRACT' },
        { label: 'Intern', value: 'INTERN' },
      ],
    }

    return NextResponse.json(metadata)
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: "Failed to fetch metadata." }, { status: 500 })
  }
}
