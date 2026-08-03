import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isHrAdminResult, requireHrAdmin } from '@/lib/hr/api-auth'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const url = new URL(request.url)

    if (url.searchParams.get('admin') === '1') {
      const ctx = await requireHrAdmin(request)
      if (isHrAdminResult(ctx)) return ctx.error
      const cycles = await prisma.performanceCycle.findMany({
        where: { companyId: ctx.companyId },
        include: {
          _count: { select: { goals: true, reviews: true } },
        },
        orderBy: { startDate: 'desc' },
      })
      return NextResponse.json({ cycles })
    }

    if (!session.user.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const goals = await prisma.performanceGoal.findMany({
      where: { employeeId: session.user.employeeId },
      include: { cycle: true },
      orderBy: { createdAt: 'desc' },
    })
    const reviews = await prisma.performanceReview.findMany({
      where: { employeeId: session.user.employeeId },
      include: { cycle: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ goals, reviews })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const body = await request.json()

    if (body.action === 'create_cycle') {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const startDate = body.startDate ? new Date(body.startDate) : null
      const endDate = body.endDate ? new Date(body.endDate) : null
      if (!name || !startDate || !endDate) {
        return NextResponse.json({ error: 'name, startDate, endDate required' }, { status: 400 })
      }
      const cycle = await prisma.performanceCycle.create({
        data: {
          companyId: ctx.companyId,
          name,
          startDate,
          endDate,
          status: 'OPEN',
        },
      })
      return NextResponse.json(cycle, { status: 201 })
    }

    if (body.action === 'add_goal') {
      const cycleId = body.cycleId as string
      const employeeId = body.employeeId as string
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      if (!cycleId || !employeeId || !title) {
        return NextResponse.json({ error: 'cycleId, employeeId, title required' }, { status: 400 })
      }
      const goal = await prisma.performanceGoal.create({
        data: {
          cycleId,
          employeeId,
          title,
          description: body.description || null,
          weight: Number(body.weight) || 1,
        },
      })
      await prisma.performanceReview.upsert({
        where: { cycleId_employeeId: { cycleId, employeeId } },
        create: {
          cycleId,
          employeeId,
          managerId: body.managerId || null,
          status: 'PENDING',
        },
        update: {},
      })
      return NextResponse.json(goal, { status: 201 })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[performance]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()

    if (body.action === 'self_review') {
      const reviewId = body.reviewId as string
      const review = await prisma.performanceReview.findFirst({
        where: { id: reviewId, employeeId: session.user.employeeId },
      })
      if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const updated = await prisma.performanceReview.update({
        where: { id: reviewId },
        data: {
          selfScore: Number(body.selfScore),
          selfNotes: body.selfNotes || null,
          status: 'SELF_DONE',
        },
      })
      return NextResponse.json(updated)
    }

    if (body.action === 'manager_review') {
      const reviewId = body.reviewId as string
      const review = await prisma.performanceReview.findFirst({
        where: {
          id: reviewId,
          OR: [
            { managerId: session.user.employeeId },
            { employee: { managerId: session.user.employeeId } },
          ],
        },
      })
      if (!review) {
        const ctx = await requireHrAdmin(request)
        if (isHrAdminResult(ctx)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const updated = await prisma.performanceReview.update({
        where: { id: reviewId },
        data: {
          managerScore: Number(body.managerScore),
          managerNotes: body.managerNotes || null,
          managerId: session.user.employeeId,
          status: 'COMPLETED',
        },
      })
      return NextResponse.json(updated)
    }

    if (body.action === 'update_goal_progress') {
      const goalId = body.goalId as string
      const goal = await prisma.performanceGoal.findFirst({
        where: { id: goalId, employeeId: session.user.employeeId },
      })
      if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const updated = await prisma.performanceGoal.update({
        where: { id: goalId },
        data: { progress: Number(body.progress) || 0 },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
