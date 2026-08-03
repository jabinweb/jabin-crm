import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isHrAdminResult, requireHrAdmin } from '@/lib/hr/api-auth'

export async function GET(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const jobs = await prisma.jobOpening.findMany({
      where: { companyId: ctx.companyId },
      include: { _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(jobs)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description =
      typeof body.description === 'string' ? body.description.trim() : ''
    if (!title || !description) {
      return NextResponse.json(
        { error: 'title and description required' },
        { status: 400 }
      )
    }
    const job = await prisma.jobOpening.create({
      data: {
        companyId: ctx.companyId,
        title,
        description,
        department: body.department || null,
        openings: Number(body.openings || 1),
        status: 'OPEN',
      },
    })
    return NextResponse.json(job, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const body = await request.json()
    const id = body.id as string
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const existing = await prisma.jobOpening.findFirst({
      where: { id, companyId: ctx.companyId },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const updated = await prisma.jobOpening.update({
      where: { id },
      data: {
        ...(body.status ? { status: String(body.status) } : {}),
        ...(body.title ? { title: String(body.title) } : {}),
      },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
