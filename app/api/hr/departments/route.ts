import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isHrAdminResult, requireHrAdmin } from '@/lib/hr/api-auth'

export async function GET(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const rows = await prisma.hrDepartment.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error('[hr/departments GET]', error)
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
    const row = await prisma.hrDepartment.create({
      data: {
        companyId: ctx.companyId,
        name,
        code: typeof body.code === 'string' ? body.code.trim() || null : null,
        parentId: typeof body.parentId === 'string' ? body.parentId : null,
        active: body.active !== false,
      },
    })
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('[hr/departments POST]', error)
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
    const existing = await prisma.hrDepartment.findFirst({
      where: { id, companyId: ctx.companyId },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const row = await prisma.hrDepartment.update({
      where: { id },
      data: {
        ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
        ...(body.code !== undefined
          ? { code: typeof body.code === 'string' ? body.code.trim() || null : null }
          : {}),
        ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
        ...(body.parentId !== undefined ? { parentId: body.parentId || null } : {}),
      },
    })
    return NextResponse.json(row)
  } catch (error) {
    console.error('[hr/departments PATCH]', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await prisma.hrDepartment.deleteMany({ where: { id, companyId: ctx.companyId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[hr/departments DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
