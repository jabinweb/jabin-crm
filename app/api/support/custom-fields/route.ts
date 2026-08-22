import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTenantRoute, jsonOk } from '@/lib/api/with-route'
import { hasLegacyRole } from '@/lib/auth/permissions'

export const GET = withTenantRoute(async (_request, { companyId }) => {
  const rows = await prisma.ticketCustomFieldDef.findMany({
    where: { companyId: companyId!, active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return jsonOk(rows)
})

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const key =
    typeof body.key === 'string'
      ? body.key.trim().toLowerCase().replace(/\s+/g, '_')
      : name.toLowerCase().replace(/\s+/g, '_')
  if (!name || !key) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const row = await prisma.ticketCustomFieldDef.create({
    data: {
      companyId: companyId!,
      name,
      key,
      fieldType: body.fieldType || 'text',
      options: body.options || null,
      required: Boolean(body.required),
      sortOrder: Number(body.sortOrder) || 0,
    },
  })
  return jsonOk(row, { status: 201 })
})

export const PATCH = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const id = body.id as string
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const existing = await prisma.ticketCustomFieldDef.findFirst({
    where: { id, companyId: companyId! },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const row = await prisma.ticketCustomFieldDef.update({
    where: { id },
    data: {
      ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
      ...(body.fieldType ? { fieldType: body.fieldType } : {}),
      ...(body.options !== undefined ? { options: body.options } : {}),
      ...(body.required !== undefined ? { required: Boolean(body.required) } : {}),
      ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) } : {}),
    },
  })
  return jsonOk(row)
})

export const DELETE = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await prisma.ticketCustomFieldDef.updateMany({
    where: { id, companyId: companyId! },
    data: { active: false },
  })
  return jsonOk({ ok: true })
})
