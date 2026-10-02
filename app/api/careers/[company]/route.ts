import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ company: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { company: slug } = await context.params
    const company = await prisma.company.findUnique({
      where: { slug },
      select: { id: true, name: true, status: true },
    })
    // Public endpoint: only approved workspaces have a careers page
    if (!company || company.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
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
    const company = await prisma.company.findUnique({
      where: { slug },
      select: { id: true, name: true, status: true },
    })
    // Public endpoint: only approved workspaces have a careers page
    if (!company || company.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const body = await request.json().catch(() => ({}))
    const jobId = typeof body.jobId === 'string' ? body.jobId : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!jobId || !name || !email) {
      return NextResponse.json({ error: 'jobId, name, email required' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length > 200) {
      return NextResponse.json({ error: 'Invalid name or email' }, { status: 400 })
    }
    // Public input: only accept http(s) resume links (no javascript:/data: URLs)
    const resumeUrl =
      typeof body.resumeUrl === 'string' && /^https?:\/\//i.test(body.resumeUrl.trim())
        ? body.resumeUrl.trim()
        : null
    const str = (v: unknown, max: number) =>
      typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
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
          phone: str(body.phone, 40),
          resumeUrl,
          source: str(body.source, 50) || 'careers',
          referredBy: str(body.referredBy, 200),
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
