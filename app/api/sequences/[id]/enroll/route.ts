import { prisma } from '@/lib/prisma';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { handleRouteError } from '@/lib/api/tenant-response';
import { NextRequest, NextResponse } from 'next/server';
import { sequenceService } from '@/lib/crm/sequence-service';
import { handleApiError } from '@/lib/api-error-handler';
import { withModuleAccess } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');

    const params = await context.params;
    const owned = await prisma.emailSequence.findFirst({
      where: { id: params.id, userId: session.user.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }
    const body = await req.json();
    const { leadIds } = body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: 'leadIds array is required' },
        { status: 400 }
      );
    }

    // Only leads in the caller's workspace can be enrolled.
    const { companyId } = await resolveCompanyContextFromRequest(session, req);
    const allowed = new Set(
      (
        await prisma.lead.findMany({
          where: { id: { in: leadIds.filter((x: unknown) => typeof x === 'string') }, companyId },
          select: { id: true },
        })
      ).map((l) => l.id)
    );

    const results = await Promise.allSettled(
      leadIds.map((leadId: string) =>
        !allowed.has(leadId)
          ? Promise.reject(new Error('Lead not found'))
          :
        sequenceService.enrollLead(params.id, leadId)
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({
      total: leadIds.length,
      succeeded,
      failed,
    });
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error enrolling leads:', error);
    }
    return handleRouteError(error);
  }
}
