import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const helpful = body.helpful !== false;

    const article = await prisma.knowledgeArticle.update({
      where: { id },
      data: helpful ? { helpfulCount: { increment: 1 } } : {},
      select: { id: true, helpfulCount: true },
    });

    return NextResponse.json(article);
  } catch (error) {
    console.error('[api/support/knowledge/helpful]', error);
    return NextResponse.json({ error: 'Failed to record feedback' }, { status: 500 });
  }
}
