import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hasLegacyRole } from '@/lib/auth/permissions'
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership'
import { asNextRequest } from '@/lib/api/as-next-request'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user || !hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { companyId } = await resolveCompanyContextFromRequest(
      session,
      asNextRequest(request)
    )
    const holidays = await prisma.companyHoliday.findMany({
      where: { companyId },
      orderBy: { date: 'asc' },
    })
    return NextResponse.json(holidays)
  } catch (error) {
    console.error('[holidays GET]', error)
    return NextResponse.json({ error: 'Failed to load holidays' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user || !hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { companyId } = await resolveCompanyContextFromRequest(
      session,
      asNextRequest(request)
    )
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const date = body.date ? new Date(body.date) : null
    const type = typeof body.type === 'string' ? body.type : 'PUBLIC'

    if (!name || !date || Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'name and date are required' }, { status: 400 })
    }

    const holiday = await prisma.companyHoliday.create({
      data: { companyId, name, date, type },
    })
    return NextResponse.json(holiday, { status: 201 })
  } catch (error) {
    console.error('[holidays POST]', error)
    return NextResponse.json({ error: 'Failed to create holiday' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth()
    if (!session?.user || !hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { companyId } = await resolveCompanyContextFromRequest(
      session,
      asNextRequest(request)
    )
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }
    await prisma.companyHoliday.deleteMany({ where: { id, companyId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[holidays DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete holiday' }, { status: 500 })
  }
}
