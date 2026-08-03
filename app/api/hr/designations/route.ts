import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isHrAdminResult, requireHrAdmin } from '@/lib/hr/api-auth'

export async function GET(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const rows = await prisma.hrDesignation.findMany({
      where: { companyId: ctx.companyId },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error('[hr/designations GET]', error)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const row = await prisma.hrDesignation.create({
      data: {
        companyId: ctx.companyId,
        name,
        code: typeof body.code === 'string' ? body.code.trim() || null : null,
        level:
          typeof body.level === 'number'
            ? body.level
            : body.level
              ? Number(body.level)
              : null,
        active: body.active !== false,
      },
    })
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('[hr/designations POST]', error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const existing = await prisma.hrDesignation.findFirst({
      where: { id, companyId: ctx.companyId },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const row = await prisma.hrDesignation.update({
      where: { id },
      data: {
        ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
        ...(body.code !== undefined
          ? { code: typeof body.code === 'string' ? body.code.trim() || null : null }
          : {}),
        ...(body.level !== undefined
          ? { level: body.level === null || body.level === '' ? null : Number(body.level) }
          : {}),
        ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
      },
    })
    return NextResponse.json(row)
  } catch (error) {
    console.error('[hr/designations PATCH]', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await prisma.hrDesignation.deleteMany({ where: { id, companyId: ctx.companyId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[hr/designations DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
