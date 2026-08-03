import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isHrAdminResult, requireHrAdmin } from '@/lib/hr/api-auth'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const url = new URL(request.url)
    if (url.searchParams.get('admin') === '1') {
      const ctx = await requireHrAdmin(request)
      if (isHrAdminResult(ctx)) return ctx.error
      const rows = await prisma.hrPolicyDoc.findMany({
        where: { companyId: ctx.companyId },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(rows)
    }
    const emp = session.user.employeeId
      ? await prisma.employee.findUnique({ where: { id: session.user.employeeId } })
      : null
    if (!emp) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rows = await prisma.hrPolicyDoc.findMany({
      where: { companyId: emp.companyId, active: true },
      orderBy: { title: 'asc' },
    })
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const fileUrl = typeof body.fileUrl === 'string' ? body.fileUrl.trim() : ''
    if (!title || !fileUrl) {
      return NextResponse.json({ error: 'title and fileUrl required' }, { status: 400 })
    }
    const row = await prisma.hrPolicyDoc.create({
      data: {
        companyId: ctx.companyId,
        title,
        fileUrl,
        category: body.category || 'HANDBOOK',
      },
    })
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await prisma.hrPolicyDoc.updateMany({
      where: { id, companyId: ctx.companyId },
      data: { active: false },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
