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
      const rows = await prisma.hrTicket.findMany({
        where: { companyId: ctx.companyId },
        include: {
          employee: { select: { name: true, employeeId: true } },
          assignee: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(rows)
    }
    if (!session.user.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const rows = await prisma.hrTicket.findMany({
      where: { employeeId: session.user.employeeId },
      orderBy: { createdAt: 'desc' },
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
    })
    if (!emp) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
    const ticketBody = typeof body.body === 'string' ? body.body.trim() : ''
    if (!subject || !ticketBody) {
      return NextResponse.json({ error: 'subject and body required' }, { status: 400 })
    }
    const row = await prisma.hrTicket.create({
      data: {
        companyId: emp.companyId,
        employeeId: emp.id,
        subject,
        body: ticketBody,
        category: body.category || 'GENERAL',
        status: 'OPEN',
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
    const existing = await prisma.hrTicket.findFirst({
      where: { id, companyId: ctx.companyId },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const updated = await prisma.hrTicket.update({
      where: { id },
      data: {
        ...(body.status ? { status: String(body.status) } : {}),
        ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId || null } : {}),
      },
    })
    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
