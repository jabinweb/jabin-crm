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
      const rows = await prisma.travelRequest.findMany({
        where: { companyId: ctx.companyId },
        include: { employee: { select: { name: true, employeeId: true } } },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(rows)
    }
    if (!session.user.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const rows = await prisma.travelRequest.findMany({
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
    const purpose = typeof body.purpose === 'string' ? body.purpose.trim() : ''
    const fromDate = body.fromDate ? new Date(body.fromDate) : null
    const toDate = body.toDate ? new Date(body.toDate) : null
    if (!purpose || !fromDate || !toDate) {
      return NextResponse.json({ error: 'purpose, fromDate, toDate required' }, { status: 400 })
    }
    const row = await prisma.travelRequest.create({
      data: {
        companyId: emp.companyId,
        employeeId: emp.id,
        purpose,
        fromDate,
        toDate,
        estimate: Number(body.estimate) || 0,
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
    const existing = await prisma.travelRequest.findFirst({
      where: { id, companyId: ctx.companyId },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const status = body.status === 'REJECTED' ? 'REJECTED' : 'APPROVED'
    const updated = await prisma.travelRequest.update({
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
