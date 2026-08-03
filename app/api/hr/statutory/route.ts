import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hasLegacyRole } from '@/lib/auth/permissions'
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership'
import { asNextRequest } from '@/lib/api/as-next-request'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const employeeId =
      new URL(request.url).searchParams.get('employeeId') || session.user.employeeId
    if (!employeeId) return NextResponse.json({ error: 'employeeId required' }, { status: 400 })

    const isAdmin = hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')
    if (!isAdmin && session.user.employeeId !== employeeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (isAdmin) {
      const { companyId } = await resolveCompanyContextFromRequest(
        session,
        asNextRequest(request)
      )
      const emp = await prisma.employee.findFirst({ where: { id: employeeId, companyId } })
      if (!emp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const profile = await prisma.statutoryProfile.findUnique({ where: { employeeId } })
    return NextResponse.json(profile)
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
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
    const employeeId = body.employeeId as string
    if (!employeeId) return NextResponse.json({ error: 'employeeId required' }, { status: 400 })
    const emp = await prisma.employee.findFirst({ where: { id: employeeId, companyId } })
    if (!emp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const profile = await prisma.statutoryProfile.upsert({
      where: { employeeId },
      create: {
        employeeId,
        pan: body.pan || null,
        uan: body.uan || null,
        pfNumber: body.pfNumber || null,
        esiNumber: body.esiNumber || null,
        pfEnabled: body.pfEnabled !== false,
        esiEnabled: body.esiEnabled !== false,
        ptEnabled: body.ptEnabled !== false,
        ptState: body.ptState || 'MH',
      },
      update: {
        pan: body.pan ?? undefined,
        uan: body.uan ?? undefined,
        pfNumber: body.pfNumber ?? undefined,
        esiNumber: body.esiNumber ?? undefined,
        pfEnabled: body.pfEnabled,
        esiEnabled: body.esiEnabled,
        ptEnabled: body.ptEnabled,
        ptState: body.ptState,
      },
    })
    return NextResponse.json(profile)
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
