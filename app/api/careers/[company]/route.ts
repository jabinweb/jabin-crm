import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ company: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { company: slug } = await context.params
    const company = await prisma.company.findUnique({ where: { slug } })
    if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const jobs = await prisma.jobOpening.findMany({
      where: { companyId: company.id, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        department: true,
        description: true,
        openings: true,
        createdAt: true,
      },
    })
    return NextResponse.json({ company: { name: company.name, slug }, jobs })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { company: slug } = await context.params
    const company = await prisma.company.findUnique({ where: { slug } })
    if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await request.json()
    const jobId = body.jobId as string
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!jobId || !name || !email) {
      return NextResponse.json({ error: 'jobId, name, email required' }, { status: 400 })
    }
    const job = await prisma.jobOpening.findFirst({
      where: { id: jobId, companyId: company.id, status: 'OPEN' },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    let candidate = await prisma.candidate.findFirst({
      where: { companyId: company.id, email },
    })
    if (!candidate) {
      candidate = await prisma.candidate.create({
        data: {
          companyId: company.id,
          name,
          email,
          phone: body.phone || null,
          resumeUrl: body.resumeUrl || null,
          source: body.source || 'careers',
          referredBy: body.referredBy || null,
        },
      })
    }

    const app = await prisma.jobApplication.upsert({
      where: { jobId_candidateId: { jobId, candidateId: candidate.id } },
      create: { jobId, candidateId: candidate.id, stage: 'APPLIED' },
      update: {},
    })
    return NextResponse.json({ ok: true, applicationId: app.id }, { status: 201 })
  } catch (e) {
    console.error('[careers apply]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
