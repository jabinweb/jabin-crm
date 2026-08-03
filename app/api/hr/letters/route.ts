import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isHrAdminResult, requireHrAdmin } from '@/lib/hr/api-auth'
import { renderLetterBody } from '@/lib/hr/onboarding'

export async function GET(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const [templates, letters] = await Promise.all([
      prisma.hrLetterTemplate.findMany({
        where: { companyId: ctx.companyId },
        orderBy: { name: 'asc' },
      }),
      prisma.hrLetter.findMany({
        where: { companyId: ctx.companyId },
        include: {
          employee: { select: { name: true, employeeId: true } },
          template: { select: { name: true, type: true } },
        },
        orderBy: { issuedAt: 'desc' },
        take: 100,
      }),
    ])
    return NextResponse.json({ templates, letters })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const body = await request.json()

    if (body.action === 'create_template') {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const letterBody = typeof body.body === 'string' ? body.body : ''
      if (!name || !letterBody) {
        return NextResponse.json({ error: 'name and body required' }, { status: 400 })
      }
      const row = await prisma.hrLetterTemplate.create({
        data: {
          companyId: ctx.companyId,
          name,
          type: body.type || 'GENERAL',
          body: letterBody,
        },
      })
      return NextResponse.json(row, { status: 201 })
    }

    if (body.action === 'issue') {
      const employeeId = body.employeeId as string
      const templateId = body.templateId as string | undefined
      let templateBody = typeof body.body === 'string' ? body.body : ''
      let title = typeof body.title === 'string' ? body.title.trim() : 'HR Letter'
      let tplId: string | null = null

      if (templateId) {
        const tpl = await prisma.hrLetterTemplate.findFirst({
          where: { id: templateId, companyId: ctx.companyId },
        })
        if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        templateBody = tpl.body
        title = body.title || tpl.name
        tplId = tpl.id
      }
      if (!employeeId || !templateBody) {
        return NextResponse.json({ error: 'employeeId and body required' }, { status: 400 })
      }

      const emp = await prisma.employee.findFirst({
        where: { id: employeeId, companyId: ctx.companyId },
      })
      if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

      const rendered = renderLetterBody(templateBody, {
        name: emp.name,
        employeeId: emp.employeeId,
        jobTitle: emp.jobTitle,
        department: emp.department,
        date: new Date().toLocaleDateString('en-IN'),
        email: emp.email,
      })

      const letter = await prisma.hrLetter.create({
        data: {
          companyId: ctx.companyId,
          employeeId,
          templateId: tplId,
          title,
          body: rendered,
        },
      })
      return NextResponse.json(letter, { status: 201 })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[letters]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
