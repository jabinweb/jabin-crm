import { NextRequest, NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/tenant-response';
import { prisma } from '@/lib/prisma';
import { isApiException } from '@/lib/api/subscription-guards';
import { handleApiError } from '@/lib/api-error-handler';
import { leadAccessWhere, requireLeadAccess } from '@/app/api/leads/lead-access';

/** Sales roles see the whole workspace's leads; other staff only leads they own. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireLeadAccess(request);
    const { id } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id, ...leadAccessWhere(ctx) },
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireLeadAccess(request);
    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    const stringFields = [
      'companyName',
      'contactName',
      'email',
      'phone',
      'website',
      'address',
      'city',
      'state',
      'country',
      'zipCode',
      'industry',
      'jobTitle',
      'description',
      'source',
      'sourceUrl',
    ] as const;
    for (const key of stringFields) {
      if (typeof body[key] === 'string') data[key] = body[key].trim();
    }
    if (Array.isArray(body.tags)) data.tags = body.tags;

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const where = { id, ...leadAccessWhere(ctx) };
    const updated = await prisma.lead.updateMany({ where, data });
    if (updated.count === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const lead = await prisma.lead.findFirst({ where: { id, companyId: ctx.companyId } });
    return NextResponse.json(lead);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleRouteError(error);
  }
}

/** Deleting a lead removes its history — sales roles only. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireLeadAccess(request);
    if (!ctx.isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;

    const deleted = await prisma.lead.deleteMany({
      where: { id, companyId: ctx.companyId },
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
