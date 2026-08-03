import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isHrAdminResult, requireHrAdmin } from '@/lib/hr/api-auth'

export async function POST(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const body = await request.json()
    const employeeId = body.employeeId as string
    const shiftId = body.shiftId as string
    if (!employeeId || !shiftId) {
      return NextResponse.json(
        { error: 'employeeId and shiftId required' },
        { status: 400 }
      )
    }
    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: ctx.companyId },
    })
    const shift = await prisma.workShift.findFirst({
      where: { id: shiftId, companyId: ctx.companyId },
    })
    if (!emp || !shift) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const row = await prisma.employeeShiftAssignment.create({
      data: {
        employeeId,
        shiftId,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
      },
      include: { shift: true },
    })
    return NextResponse.json(row, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
