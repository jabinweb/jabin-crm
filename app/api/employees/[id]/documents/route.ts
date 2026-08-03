import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hasLegacyRole } from '@/lib/auth/permissions'
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership'
import { asNextRequest } from '@/lib/api/as-next-request'
import { logEmployeeActivity } from '@/lib/hr/activity'

async function assertCanAccessEmployee(
  request: Request,
  employeeId: string,
  opts: { write?: boolean } = {}
): Promise<
  | { error: NextResponse }
  | { session: Session; employee: { id: string; companyId: string } }
> {
  const session = await auth()
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, companyId: true },
  })
  if (!employee) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }

  const isAdmin = hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')
  const isSelf = session.user.employeeId === employeeId

  if (opts.write) {
    if (!isAdmin && !isSelf) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
  } else if (!isAdmin && !isSelf) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  if (isAdmin) {
    try {
      const { companyId } = await resolveCompanyContextFromRequest(
        session,
        asNextRequest(request)
      )
      if (employee.companyId !== companyId && !hasLegacyRole(session, 'SUPER_ADMIN')) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
      }
    } catch {
      if (!isSelf) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
      }
    }
  }

  return { session, employee }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await assertCanAccessEmployee(request, id)
    if ('error' in ctx) return ctx.error

    const docs = await prisma.employeeDocument.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(docs)
  } catch (error) {
    console.error('[employee documents GET]', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await assertCanAccessEmployee(request, id, { write: true })
    if ('error' in ctx) return ctx.error

    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const fileUrl = typeof body.fileUrl === 'string' ? body.fileUrl.trim() : ''
    if (!title || !fileUrl) {
      return NextResponse.json({ error: 'title and fileUrl required' }, { status: 400 })
    }

    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId: id,
        title,
        category: typeof body.category === 'string' ? body.category : 'GENERAL',
        fileUrl,
        mimeType: typeof body.mimeType === 'string' ? body.mimeType : null,
        uploadedById: ctx.session.user.employeeId ?? null,
      },
    })

    await logEmployeeActivity({
      employeeId: id,
      actorId: ctx.session.user.employeeId,
      type: 'DOCUMENT_UPLOAD',
      message: `Document uploaded: ${title}`,
      meta: { documentId: doc.id },
    })

    return NextResponse.json(doc, { status: 201 })
  } catch (error) {
    console.error('[employee documents POST]', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await assertCanAccessEmployee(request, id, { write: true })
    if ('error' in ctx) return ctx.error
    const docId = new URL(request.url).searchParams.get('docId')
    if (!docId) return NextResponse.json({ error: 'docId required' }, { status: 400 })
    await prisma.employeeDocument.deleteMany({
      where: { id: docId, employeeId: id },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[employee documents DELETE]', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
