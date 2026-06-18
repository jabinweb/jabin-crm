import { NextRequest, NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ensureFeatureEnabled, isFeatureEnabledForCompany } from '@/lib/feature-modules';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';

async function resolveKnowledgeCompanyId(session: Session | null) {
  if (!session?.user) return null;
  if (session.user.role === 'CUSTOMER' && session.user.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: session.user.customerId },
      select: { companyId: true },
    });
    return customer?.companyId ?? null;
  }
  if (session.user.companyId) return session.user.companyId;
  if (session.user.primaryCompanyId) return session.user.primaryCompanyId;
  return null;
}

/** Public knowledge base articles for customer portal */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const companyId = await resolveKnowledgeCompanyId(session);

    if (session?.user?.role && session.user.role !== 'CUSTOMER') {
      await ensureFeatureEnabled(session.user.id, 'SUPPORT_KNOWLEDGE');
    } else if (session?.user?.customerId && companyId) {
      const enabled = await isFeatureEnabledForCompany(companyId, 'SUPPORT_KNOWLEDGE');
      if (!enabled) {
        return NextResponse.json({ articles: [], categories: [] });
      }
    }

    const { searchParams } = req.nextUrl;
    const q = searchParams.get('q')?.trim();
    const category = searchParams.get('category')?.trim();
    const slug = searchParams.get('slug')?.trim();
    const ticketType = searchParams.get('ticketType')?.trim();

    const companyFilter = companyId
      ? { OR: [{ companyId }, { companyId: null }] }
      : { companyId: null };

    if (slug) {
      const article = await prisma.knowledgeArticle.findFirst({
        where: { slug, published: true, ...companyFilter },
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
          category: true,
          tags: true,
          viewCount: true,
          helpfulCount: true,
          updatedAt: true,
        },
      });
      if (!article) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      await prisma.knowledgeArticle.update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } },
      });
      return NextResponse.json(article);
    }

    const tagFilter = ticketType
      ? { tags: { hasSome: [ticketType, `type:${ticketType}`] } }
      : {};

    const articles = await prisma.knowledgeArticle.findMany({
      where: {
        published: true,
        ...companyFilter,
        ...tagFilter,
        ...(category ? { category } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { content: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        tags: true,
        updatedAt: true,
      },
    });

    const categories = await prisma.knowledgeArticle.groupBy({
      by: ['category'],
      where: { published: true, category: { not: null }, ...companyFilter },
      _count: true,
    });

    return NextResponse.json({ articles, categories });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('[api/support/knowledge GET]', error);
    return NextResponse.json({ error: 'Failed to load articles' }, { status: 500 });
  }
}

/** Agent/admin: create or update articles */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user || !role || !['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'SUPPORT_KNOWLEDGE');

    const body = await req.json();
    const slug =
      body.slug ||
      body.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const article = await prisma.knowledgeArticle.create({
      data: {
        title: body.title,
        slug,
        content: body.content,
        category: body.category,
        tags: body.tags ?? [],
        published: body.published ?? false,
        companyId: body.companyId ?? null,
      },
    });

    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    console.error('[api/support/knowledge POST]', error);
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user || !role || !['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'SUPPORT_KNOWLEDGE');

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Article id required' }, { status: 400 });
    }

    const article = await prisma.knowledgeArticle.update({
      where: { id: body.id },
      data: {
        title: body.title,
        content: body.content,
        category: body.category,
        tags: body.tags,
        published: body.published,
      },
    });

    return NextResponse.json(article);
  } catch (error) {
    console.error('[api/support/knowledge PATCH]', error);
    return NextResponse.json({ error: 'Failed to update article' }, { status: 500 });
  }
}
