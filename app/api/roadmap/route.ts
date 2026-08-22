import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTenantRoute, jsonOk } from '@/lib/api/with-route'
import { hasLegacyRole } from '@/lib/auth/permissions'

export const GET = withTenantRoute(async (request, { companyId }) => {
  const publishedOnly = new URL(request.url).searchParams.get('public') === '1'
  const items = await prisma.roadmapItem.findMany({
    where: {
      companyId: companyId!,
      ...(publishedOnly ? { published: true } : {}),
    },
    include: { _count: { select: { votes: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })
  return jsonOk(items)
})

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  const row = await prisma.roadmapItem.create({
    data: {
      companyId: companyId!,
      title,
      description: body.description || null,
      status: body.status || 'considering',
      published: body.published !== false,
    },
  })
  return jsonOk(row, { status: 201 })
})

export const PATCH = withTenantRoute(async (request, { session, companyId }) => {
  const body = await request.json()
  const id = body.id as string
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (body.action === 'vote') {
    const voterKey = session.user.id || session.user.email || 'anon'
    const item = await prisma.roadmapItem.findFirst({
      where: { id, companyId: companyId!, published: true },
    })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    try {
      await prisma.roadmapVote.create({ data: { itemId: id, voterKey } })
    } catch {
      await prisma.roadmapVote.deleteMany({ where: { itemId: id, voterKey } })
      return jsonOk({ voted: false })
    }
    return jsonOk({ voted: true })
  }

  if (!hasLegacyRole(session, 'ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const existing = await prisma.roadmapItem.findFirst({
    where: { id, companyId: companyId! },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const row = await prisma.roadmapItem.update({
    where: { id },
    data: {
      ...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(body.published !== undefined ? { published: Boolean(body.published) } : {}),
    },
  })
  return jsonOk(row)
})
