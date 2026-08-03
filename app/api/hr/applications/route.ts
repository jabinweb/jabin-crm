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
    const jobId = new URL(request.url).searchParams.get('jobId') || undefined
    const apps = await prisma.jobApplication.findMany({
      where: {
        job: { companyId },
        ...(jobId ? { jobId } : {}),
      },
      include: {
        candidate: true,
        job: { select: { id: true, title: true } },
        interviews: { orderBy: { scheduledAt: 'desc' }, take: 3 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    })
    return NextResponse.json(apps)
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
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

    if (body.action === 'add_candidate') {
      const jobId = body.jobId as string
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      if (!jobId || !name || !email) {
        return NextResponse.json({ error: 'jobId, name, email required' }, { status: 400 })
      }
      const job = await prisma.jobOpening.findFirst({ where: { id: jobId, companyId } })
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

      let candidate = await prisma.candidate.findFirst({
        where: { companyId, email },
      })
      if (!candidate) {
        candidate = await prisma.candidate.create({
          data: {
            companyId,
            name,
            email,
            phone: body.phone || null,
            resumeUrl: body.resumeUrl || null,
            source: body.source || 'manual',
          },
        })
      }

      const app = await prisma.jobApplication.upsert({
        where: { jobId_candidateId: { jobId, candidateId: candidate.id } },
        create: { jobId, candidateId: candidate.id, stage: 'APPLIED' },
        update: {},
        include: { candidate: true, job: true },
      })
      return NextResponse.json(app, { status: 201 })
    }

    if (body.action === 'set_stage') {
      const id = body.id as string
      const stage = body.stage as string
      const app = await prisma.jobApplication.findFirst({
        where: { id, job: { companyId } },
      })
      if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const updated = await prisma.jobApplication.update({
        where: { id },
        data: { stage },
      })
      return NextResponse.json(updated)
    }

    if (body.action === 'schedule_interview') {
      const applicationId = body.applicationId as string
      const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null
      if (!applicationId || !scheduledAt || Number.isNaN(scheduledAt.getTime())) {
        return NextResponse.json(
          { error: 'applicationId and scheduledAt required' },
          { status: 400 }
        )
      }
      const app = await prisma.jobApplication.findFirst({
        where: { id: applicationId, job: { companyId } },
      })
      if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const interview = await prisma.interview.create({
        data: {
          applicationId,
          scheduledAt,
          interviewerId: body.interviewerId || session.user.employeeId || null,
          mode: body.mode || 'ONLINE',
          scorecard: body.scorecard || undefined,
          score: typeof body.score === 'number' ? body.score : undefined,
          feedback: typeof body.feedback === 'string' ? body.feedback : undefined,
        },
      })
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { stage: 'INTERVIEW' },
      })
      return NextResponse.json(interview, { status: 201 })
    }

    if (body.action === 'score_interview') {
      const interviewId = body.interviewId as string
      const interview = await prisma.interview.findFirst({
        where: { id: interviewId, application: { job: { companyId } } },
      })
      if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const updated = await prisma.interview.update({
        where: { id: interviewId },
        data: {
          scorecard: body.scorecard || interview.scorecard,
          score: typeof body.score === 'number' ? body.score : interview.score,
          feedback:
            typeof body.feedback === 'string' ? body.feedback : interview.feedback,
          status: 'COMPLETED',
        },
      })
      return NextResponse.json(updated)
    }

    if (body.action === 'hire') {
      const applicationId = body.applicationId as string
      const app = await prisma.jobApplication.findFirst({
        where: { id: applicationId, job: { companyId } },
        include: { candidate: true, job: true },
      })
      if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const { nextEmployeeCode } = await import('@/lib/hr/employee-id')
      const { startOnboardingForEmployee } = await import('@/lib/hr/onboarding')
      const code = await nextEmployeeCode(companyId)

      const employee = await prisma.employee.create({
        data: {
          companyId,
          employeeId: code,
          name: app.candidate.name,
          email: app.candidate.email,
          phone: app.candidate.phone || '',
          address: {},
          jobTitle: app.job.title,
          department: app.job.department || 'General',
          status: 'ACTIVE',
          isApproved: true,
          employmentType: 'FULL_TIME',
        },
      })

      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { stage: 'HIRED' },
      })
      await prisma.candidate.update({
        where: { id: app.candidateId },
        data: { talentPool: false, bgvStatus: body.bgvStatus || 'CLEARED' },
      })

      try {
        await startOnboardingForEmployee(employee.id, companyId)
      } catch (e) {
        console.warn('[hire] onboarding', e)
      }

      return NextResponse.json({ employee, applicationId }, { status: 201 })
    }

    if (body.action === 'analytics') {
      const apps = await prisma.jobApplication.groupBy({
        by: ['stage'],
        where: { job: { companyId } },
        _count: true,
      })
      return NextResponse.json({ byStage: apps })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[ats applications]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
