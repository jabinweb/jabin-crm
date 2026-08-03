import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isHrAdminResult, requireHrAdmin } from '@/lib/hr/api-auth'
import { ensureLeavePolicies } from '@/lib/hr/leave-service'
import { carryForwardLeaveBalances } from '@/lib/hr/leave-year'

export async function GET(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const rows = await ensureLeavePolicies(ctx.companyId)
    return NextResponse.json(rows)
  } catch (error) {
    console.error('[hr/leave-policies GET]', error)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const body = await request.json()

    if (body.action === 'carry_forward') {
      const fromYear = Number(body.fromYear) || new Date().getFullYear() - 1
      const result = await carryForwardLeaveBalances(ctx.companyId, fromYear)
      return NextResponse.json(result)
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    if (!name || !code) {
      return NextResponse.json({ error: 'name and code required' }, { status: 400 })
    }
    const row = await prisma.leavePolicy.create({
      data: {
        companyId: ctx.companyId,
        name,
        code,
        daysPerYear: Number(body.daysPerYear) || 12,
        carryForwardMax: Number(body.carryForwardMax) || 0,
        isPaid: body.isPaid !== false,
        active: body.active !== false,
      },
    })
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('[hr/leave-policies POST]', error)
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
    const existing = await prisma.leavePolicy.findFirst({
      where: { id, companyId: ctx.companyId },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const row = await prisma.leavePolicy.update({
      where: { id },
      data: {
        ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
        ...(typeof body.code === 'string' ? { code: body.code.trim().toUpperCase() } : {}),
        ...(body.daysPerYear !== undefined
          ? { daysPerYear: Number(body.daysPerYear) }
          : {}),
        ...(body.carryForwardMax !== undefined
          ? { carryForwardMax: Number(body.carryForwardMax) }
          : {}),
        ...(body.isPaid !== undefined ? { isPaid: Boolean(body.isPaid) } : {}),
        ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
      },
    })
    return NextResponse.json(row)
  } catch (error) {
    console.error('[hr/leave-policies PATCH]', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await prisma.leavePolicy.updateMany({
      where: { id, companyId: ctx.companyId },
      data: { active: false },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[hr/leave-policies DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
