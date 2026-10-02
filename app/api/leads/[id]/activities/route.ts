import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { leadAccessWhere, requireLeadAccess } from '@/app/api/leads/lead-access';
import { isApiException } from '@/lib/api/subscription-guards';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const leadCtx = await requireLeadAccess(request);
    const session = leadCtx.session;

    const { id } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id, ...leadAccessWhere(leadCtx) },
      select: { id: true },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const activities = await prisma.leadActivity.findMany({
      where: { leadId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      take: 50,
    });

    return NextResponse.json({ activities });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error fetching lead activities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
