import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isHrAdminResult, requireHrAdmin } from '@/lib/hr/api-auth'

export async function GET(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() || ''
    const departmentId = searchParams.get('departmentId') || undefined
    const branchId = searchParams.get('branchId') || undefined

    const employees = await prisma.employee.findMany({
      where: {
        companyId: ctx.companyId,
        status: { in: ['ACTIVE', 'ON_LEAVE'] },
        ...(departmentId ? { departmentId } : {}),
        ...(branchId ? { branchId } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                { employeeId: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        phone: true,
        department: true,
        jobTitle: true,
        avatar: true,
        status: true,
        hrDepartment: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
      take: 200,
    })

    return NextResponse.json(employees)
  } catch (error) {
    console.error('[directory]', error)
    return NextResponse.json({ error: 'Failed to load directory' }, { status: 500 })
  }
}
