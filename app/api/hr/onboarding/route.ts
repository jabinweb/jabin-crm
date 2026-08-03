import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isHrAdminResult, requireHrAdmin } from '@/lib/hr/api-auth'
import { startOnboardingForEmployee } from '@/lib/hr/onboarding'

const DEFAULT_ITEMS = [
  { title: 'Submit ID proof', done: false },
  { title: 'Bank account details', done: false },
  { title: 'Policy acknowledgement', done: false },
  { title: 'IT asset allocation', done: false },
  { title: 'Buddy introduction', done: false },
]

export async function GET(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const [templates, checklists] = await Promise.all([
      prisma.onboardingTemplate.findMany({ where: { companyId: ctx.companyId } }),
      prisma.onboardingChecklist.findMany({
        where: { employee: { companyId: ctx.companyId } },
        include: { employee: { select: { id: true, name: true, employeeId: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    return NextResponse.json({ templates, checklists })
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
      const name = typeof body.name === 'string' ? body.name.trim() : 'Default onboarding'
      const row = await prisma.onboardingTemplate.create({
        data: {
          companyId: ctx.companyId,
          name,
          items: body.items || DEFAULT_ITEMS.map((i) => ({ title: i.title })),
        },
      })
      return NextResponse.json(row, { status: 201 })
    }

    if (body.action === 'start') {
      const employeeId = body.employeeId as string
      if (!employeeId) {
        return NextResponse.json({ error: 'employeeId required' }, { status: 400 })
      }
      const row = await startOnboardingForEmployee(
        employeeId,
        ctx.companyId,
        body.templateId
      )
      return NextResponse.json(row, { status: 201 })
    }

    if (body.action === 'toggle_item') {
      const checklistId = body.checklistId as string
      const index = Number(body.index)
      const checklist = await prisma.onboardingChecklist.findFirst({
        where: { id: checklistId, employee: { companyId: ctx.companyId } },
      })
      if (!checklist) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const items = Array.isArray(checklist.items)
        ? ([...(checklist.items as object[])] as {
            title: string
            done: boolean
            doneAt?: string
          }[])
        : []
      if (!items[index]) return NextResponse.json({ error: 'Invalid item' }, { status: 400 })
      items[index] = {
        ...items[index],
        done: !items[index].done,
        doneAt: new Date().toISOString(),
      }
      const allDone = items.every((i) => i.done)
      const updated = await prisma.onboardingChecklist.update({
        where: { id: checklistId },
        data: { items, status: allDone ? 'COMPLETED' : 'IN_PROGRESS' },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[onboarding]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
