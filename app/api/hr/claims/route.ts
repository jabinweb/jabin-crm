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
      const rows = await prisma.expense.findMany({
        where: {
          companyId: ctx.companyId,
          OR: [{ status: { not: 'RECORDED' } }, { reimbursable: true }],
        },
        include: { employee: { select: { name: true, employeeId: true } } },
        orderBy: { date: 'desc' },
        take: 200,
      })
      return NextResponse.json(rows)
    }

    if (!session.user.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const rows = await prisma.expense.findMany({
      where: { employeeId: session.user.employeeId },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const emp = await prisma.employee.findUnique({
      where: { id: session.user.employeeId },
      select: { companyId: true },
    })
    if (!emp) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const amount = Number(body.amount)
    if (!description || Number.isNaN(amount)) {
      return NextResponse.json({ error: 'description and amount required' }, { status: 400 })
    }
    const row = await prisma.expense.create({
      data: {
        companyId: emp.companyId,
        employeeId: session.user.employeeId,
        description,
        amount,
        date: body.date ? new Date(body.date) : new Date(),
        category: body.category || 'GENERAL',
        receiptUrl: body.receiptUrl || null,
        reimbursable: true,
        status: 'PENDING',
      },
    })
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const body = await request.json()
    const id = body.id as string
    const existing = await prisma.expense.findFirst({
      where: { id, companyId: ctx.companyId },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const status = body.status === 'REJECTED' ? 'REJECTED' : 'APPROVED'
    const updated = await prisma.expense.update({
      where: { id },
      data: {
        status,
        actionById: ctx.session.user.employeeId || null,
        actionAt: new Date(),
      },
    })
    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
