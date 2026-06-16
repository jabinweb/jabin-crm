import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'SUPPORT_CANNED');

    const responses = await prisma.supportCannedResponse.findMany({
      where: { isShared: true },
      orderBy: { title: 'asc' },
      take: 100,
    });

    return NextResponse.json(responses);
  } catch (error) {
    console.error('[api/support/canned-responses GET]', error);
    return NextResponse.json({ error: 'Failed to load canned responses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user || !role || !['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'SUPPORT_CANNED');

    const body = await req.json();
    if (!body.title?.trim() || !body.body?.trim()) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    const response = await prisma.supportCannedResponse.create({
      data: {
        title: body.title.trim(),
        body: body.body.trim(),
        category: body.category,
        isShared: body.isShared ?? true,
        createdById: session.user.id,
        companyId: body.companyId ?? null,
      },
    });

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[api/support/canned-responses POST]', error);
    return NextResponse.json({ error: 'Failed to create canned response' }, { status: 500 });
  }
}
