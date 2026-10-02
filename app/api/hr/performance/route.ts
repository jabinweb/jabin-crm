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
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
        return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
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
      // Cycle, employee and reviewing manager must all belong to this workspace
      const managerId = typeof body.managerId === 'string' && body.managerId ? body.managerId : null
      const [cycle, emp, mgr] = await Promise.all([
        prisma.performanceCycle.findFirst({ where: { id: cycleId, companyId: ctx.companyId }, select: { id: true } }),
        prisma.employee.findFirst({ where: { id: employeeId, companyId: ctx.companyId }, select: { id: true } }),
        managerId
          ? prisma.employee.findFirst({ where: { id: managerId, companyId: ctx.companyId }, select: { id: true } })
          : Promise.resolve(true),
      ])
      if (!cycle || !emp || !mgr) {
        return NextResponse.json({ error: 'Cycle, employee or manager not found' }, { status: 404 })
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
          managerId,
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
      const selfScore = Number(body.selfScore)
      if (!Number.isFinite(selfScore)) {
        return NextResponse.json({ error: 'selfScore must be a number' }, { status: 400 })
      }
      const updated = await prisma.performanceReview.update({
        where: { id: reviewId },
        data: {
          selfScore,
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
        // Admin fallback is limited to reviews in the admin's workspace
        const inCompany = await prisma.performanceReview.findFirst({
          where: { id: reviewId, cycle: { companyId: ctx.companyId } },
          select: { employeeId: true },
        })
        if (!inCompany) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        if (inCompany.employeeId === session.user.employeeId) {
          return NextResponse.json({ error: 'You cannot review yourself' }, { status: 403 })
        }
      } else if (review.employeeId === session.user.employeeId) {
        return NextResponse.json({ error: 'You cannot review yourself' }, { status: 403 })
      }
      const managerScore = Number(body.managerScore)
      if (!Number.isFinite(managerScore)) {
        return NextResponse.json({ error: 'managerScore must be a number' }, { status: 400 })
      }
      const updated = await prisma.performanceReview.update({
        where: { id: reviewId },
        data: {
          managerScore,
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
