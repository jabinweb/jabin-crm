import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hasLegacyRole } from '@/lib/auth/permissions'
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership'
import { asNextRequest } from '@/lib/api/as-next-request'

async function assertAdminOrSelf(request: Request, employeeId: string, write = false) {
  const session = await auth()
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { companyId: true },
  })
  if (!employee) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  const isAdmin = hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')
  const isSelf = session.user.employeeId === employeeId
  if (write && !isAdmin && !isSelf) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  if (!isAdmin && !isSelf) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  if (isAdmin) {
    const { companyId } = await resolveCompanyContextFromRequest(
      session,
      asNextRequest(request)
    )
    if (employee.companyId !== companyId) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
  }
  return { session }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await assertAdminOrSelf(request, id)
    if ('error' in ctx && ctx.error) return ctx.error
    const rows = await prisma.employeeDependent.findMany({
      where: { employeeId: id },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(rows)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await assertAdminOrSelf(request, id, true)
    if ('error' in ctx && ctx.error) return ctx.error
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const relation = typeof body.relation === 'string' ? body.relation.trim() : ''
    if (!name || !relation) {
      return NextResponse.json({ error: 'name and relation required' }, { status: 400 })
    }
    const row = await prisma.employeeDependent.create({
      data: {
        employeeId: id,
        name,
        relation,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      },
    })
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await assertAdminOrSelf(request, id, true)
    if ('error' in ctx && ctx.error) return ctx.error
    const dependentId = new URL(request.url).searchParams.get('dependentId')
    if (!dependentId) {
      return NextResponse.json({ error: 'dependentId required' }, { status: 400 })
    }
    await prisma.employeeDependent.deleteMany({
      where: { id: dependentId, employeeId: id },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
