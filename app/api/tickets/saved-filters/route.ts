import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTenantRoute, jsonOk } from '@/lib/api/with-route'

export const GET = withTenantRoute(async (_request, { session, companyId }) => {
  const rows = await prisma.savedTicketFilter.findMany({
    where: { companyId: companyId!, userId: session.user.id },
    orderBy: { name: 'asc' },
  })
  return jsonOk(rows)
})

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const row = await prisma.savedTicketFilter.upsert({
    where: {
      userId_name: { userId: session.user.id, name },
    },
    create: {
      companyId: companyId!,
      userId: session.user.id,
      name,
      filters: body.filters || {},
    },
    update: { filters: body.filters || {} },
  })
  return jsonOk(row, { status: 201 })
})

export const DELETE = withTenantRoute(async (request, { session, companyId }) => {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await prisma.savedTicketFilter.deleteMany({
    where: { id, companyId: companyId!, userId: session.user.id },
  })
  return jsonOk({ ok: true })
})
