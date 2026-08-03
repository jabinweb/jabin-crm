import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isHrAdminResult, requireHrAdmin } from '@/lib/hr/api-auth'

export async function GET(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error

    const employees = await prisma.employee.findMany({
      where: {
        companyId: ctx.companyId,
        status: { in: ['ACTIVE', 'ON_LEAVE', 'PENDING'] },
      },
      select: {
        id: true,
        name: true,
        jobTitle: true,
        department: true,
        managerId: true,
        avatar: true,
        designation: { select: { name: true } },
        hrDepartment: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(employees)
  } catch (error) {
    console.error('[org-chart]', error)
    return NextResponse.json({ error: 'Failed to load org chart' }, { status: 500 })
  }
}
