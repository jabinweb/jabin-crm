import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolvePortalDataAccess } from '@/lib/api/portal-access';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const access = resolvePortalDataAccess(session);
    if (!access.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (access.scope === 'staff') {
      return NextResponse.json({ tickets: [], projects: [], quotations: [] });
    }

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) {
      return NextResponse.json({ tickets: [], projects: [], quotations: [] });
    }

    const contains = { contains: q, mode: 'insensitive' as const };

    const [tickets, projects, quotations] = await Promise.all([
      prisma.supportTicket.findMany({
        where: {
          customerId: access.customerId,
          OR: [{ subject: contains }, { description: contains }, { id: contains }],
        },
        select: {
          id: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.project.findMany({
        where: {
          customerId: access.customerId,
          status: { not: 'CANCELLED' },
          OR: [{ name: contains }, { description: contains }],
        },
        select: {
          id: true,
          name: true,
          status: true,
          progress: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.quotation.findMany({
        where: {
          customerId: access.customerId,
          OR: [{ title: contains }, { quotationNumber: contains }],
        },
        select: {
          id: true,
          title: true,
          quotationNumber: true,
          status: true,
          total: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    ]);

    return NextResponse.json({ tickets, projects, quotations });
  } catch (error) {
    console.error('[api/portal/search]', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
