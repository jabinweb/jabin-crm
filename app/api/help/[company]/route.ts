import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ company: string }> }

/** Public help hub: published KB + roadmap for a company slug. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { company: slug } = await context.params
    const company = await prisma.company.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    })
    if (!company) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [knowledge, roadmap] = await Promise.all([
      prisma.knowledgeArticle.findMany({
        where: { companyId: company.id, published: true },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          slug: true,
          category: true,
          updatedAt: true,
        },
      }),
      prisma.roadmapItem.findMany({
        where: { companyId: company.id, published: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        take: 50,
        include: { _count: { select: { votes: true } } },
      }),
    ])

    return NextResponse.json({
      company: { name: company.name, slug: company.slug },
      knowledge,
      roadmap,
    })
  } catch (e) {
    console.error('[help hub]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
