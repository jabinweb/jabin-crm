import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { dealService } from '@/lib/crm/deal-service';
import { rejectIfOutsideCompanyPipeline } from '@/lib/pipelines/assert-stage';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';

function isCompanyAdmin(role?: string) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('DEALS');
    const params = await context.params;

    let companyId: string | undefined;
    if (isCompanyAdmin(session.user.role)) {
      try {
        const ctx = await resolveCompanyContextFromRequest(session, req);
        companyId = ctx.companyId;
      } catch {
        /* user-scoped */
      }
    }

    const deal = await dealService.getDealById(params.id, {
      userId: session.user.id,
      companyId,
    });
    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }
    return NextResponse.json(deal);
  } catch (error: any) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error fetching deal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('DEALS');

    const params = await context.params;
    const body = await req.json();

    let companyId: string | undefined;
    if (isCompanyAdmin(session.user.role)) {
      try {
        const ctx = await resolveCompanyContextFromRequest(session, req);
        companyId = ctx.companyId;
      } catch {
        /* user-scoped */
      }
    }

    const existing = await dealService.getDealById(params.id, {
      userId: session.user.id,
      companyId,
    });
    if (!existing) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    if (body.stage) {
      const rejected = await rejectIfOutsideCompanyPipeline(
        existing.lead?.companyId,
        'deals',
        body.stage
      );
      if (rejected) return rejected;
    }

    const deal = await dealService.updateDeal(params.id, body);

    return NextResponse.json(deal);
  } catch (error: any) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error updating deal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await withModuleAccess('DEALS');

    const params = await context.params;
    await dealService.deleteDeal(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error deleting deal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
