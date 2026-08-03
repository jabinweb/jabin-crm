import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hasLegacyRole } from '@/lib/auth/permissions'
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership'
import { asNextRequest } from '@/lib/api/as-next-request'

function companyIdFromSessionUser(user: unknown): string | undefined {
  const u = user as {
    employeeCompanyId?: string
    companyId?: string
    primaryCompanyId?: string
  } | null | undefined
  return u?.employeeCompanyId ?? u?.companyId ?? u?.primaryCompanyId
}

async function resolveCompanyId(
  session: Session | null,
  request: Request
): Promise<string | undefined> {
  if (!session?.user) return undefined

  try {
    const ctx = await resolveCompanyContextFromRequest(
      session,
      asNextRequest(request)
    )
    if (ctx.companyId) return ctx.companyId
  } catch {
    // fall through
  }

  const fromSession = companyIdFromSessionUser(session.user)
  if (fromSession) return String(fromSession)

  const employeeId = (session.user as { employeeId?: string }).employeeId
  if (employeeId) {
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true },
    })
    return emp?.companyId
  }

  return undefined
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')
    const employeeId = (session.user as { employeeId?: string }).employeeId
    if (!isAdmin && !employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fromQuery = searchParams.get('companyId')?.trim()
    const companyId = fromQuery || (await resolveCompanyId(session, request))

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required (query or session)' },
        { status: 400 }
      )
    }

    const announcements = await prisma.announcement.findMany({
      where: { companyId: String(companyId) },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    })

    return NextResponse.json(announcements)
  } catch (error) {
    console.error('Error fetching announcements:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const companyId = await resolveCompanyId(session, request)
    if (!companyId) {
      return NextResponse.json({ error: 'No company context' }, { status: 400 })
    }

    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        priority: typeof body.priority === 'number' ? body.priority : 0,
        companyId: String(companyId),
      },
    })

    return NextResponse.json(announcement, { status: 201 })
  } catch (error) {
    console.error('Error creating announcement:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
