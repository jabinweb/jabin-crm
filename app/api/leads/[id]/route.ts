import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { handleRouteError } from '@/lib/api/tenant-response';
import { prisma } from '@/lib/prisma';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';
import { handleApiError } from '@/lib/api-error-handler';
import { guardAgentFeature, isApiException } from '@/lib/api/subscription-guards';

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

    const lead = await prisma.lead.findFirst({
      where: {
        id,
        userId: session.user.id,
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
    return handleRouteError(error);
    if (isApiException(error)) return handleApiError(error);
    console.error('Error fetching lead:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lead' },
      { status: 500 }
    );
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
    return handleRouteError(error);
    if (isApiException(error)) return handleApiError(error);
    console.error('Error deleting lead:', error);
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}
