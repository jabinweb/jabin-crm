import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ company: string }> }

/** Public roadmap vote (no auth). Uses client-provided voterKey (e.g. localStorage). */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { company: slug } = await context.params
    const company = await prisma.company.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const itemId = typeof body.itemId === 'string' ? body.itemId : ''
    const voterKey =
      typeof body.voterKey === 'string' && body.voterKey.trim().length >= 8
        ? body.voterKey.trim().slice(0, 128)
        : ''
    if (!itemId || !voterKey) {
      return NextResponse.json({ error: 'itemId and voterKey required' }, { status: 400 })
    }

    const item = await prisma.roadmapItem.findFirst({
      where: { id: itemId, companyId: company.id, published: true },
    })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    try {
      await prisma.roadmapVote.create({ data: { itemId, voterKey } })
      return NextResponse.json({ voted: true })
    } catch {
      await prisma.roadmapVote.deleteMany({ where: { itemId, voterKey } })
      return NextResponse.json({ voted: false })
    }
  } catch (e) {
    console.error('[help roadmap vote]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
