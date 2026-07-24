import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { handleRouteError } from '@/lib/api/tenant-response';
import { prisma } from '@/lib/prisma';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { guardAgentFeature, isApiException } from '@/lib/api/subscription-guards';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await guardAgentFeature(session.user as { id: string; role?: string }, 'LEADS');

    const { id } = await params;
    const role = (session.user as { role?: string }).role;
    const isAdmin =
      role === 'ADMIN' ||
      role === 'SUPER_ADMIN' ||
      role === 'SALES' ||
      role === 'SUPPORT_MANAGER';

    let companyId: string | undefined;
    try {
      const ctx = await resolveCompanyContextFromRequest(session, request);
      companyId = ctx.companyId;
    } catch {
      /* fall through */
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id,
        ...(companyId && isAdmin
          ? { companyId }
          : { userId: session.user.id }),
      },
      include: {
        score: {
          select: {
            totalScore: true,
            engagementScore: true,
            dataQualityScore: true,
            fitScore: true,
            lastCalculatedAt: true,
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json(lead);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await guardAgentFeature(session.user as { id: string; role?: string }, 'LEADS');

    const { companyId } = await resolveCompanyContextFromRequest(session, request);
    const { id } = await params;

    const deleted = await prisma.lead.deleteMany({
      where: { id, companyId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleRouteError(error);
  }
}
