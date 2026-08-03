import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isHrAdminResult, requireHrAdmin } from '@/lib/hr/api-auth'

export async function GET(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const rows = await prisma.workShift.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { assignments: true } } },
    })
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const row = await prisma.workShift.create({
      data: {
        companyId: ctx.companyId,
        name,
        code: body.code || null,
        startTime: body.startTime || '09:00',
        endTime: body.endTime || '18:00',
        graceMinutes: Number(body.graceMinutes ?? 15),
        weeklyOff: body.weeklyOff ?? [0],
      },
    })
    return NextResponse.json(row, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await prisma.workShift.deleteMany({ where: { id, companyId: ctx.companyId } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
