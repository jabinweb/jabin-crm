import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { dealService } from '@/lib/crm/deal-service';
import { prisma } from '@/lib/prisma';
import { resolveCompanyContextFromRequest, TenantError } from '@/lib/auth/company-membership';
import { handleRouteError } from '@/lib/api/tenant-response';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('DEALS');

    const params = await context.params;
    const { companyId } = await resolveCompanyContextFromRequest(session, req);
    const owned = await prisma.deal.findFirst({
      where: { id: params.id, lead: { companyId } },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action, lostReason } = body;

    let deal;
    if (action === 'next') {
      deal = await dealService.moveToNextStage(params.id);
    } else if (action === 'won') {
      deal = await dealService.markAsWon(params.id);
    } else if (action === 'lost') {
      deal = await dealService.markAsLost(params.id, lostReason || 'No reason provided');
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(deal);
  } catch (error: any) {
    if (isApiException(error)) return handleApiError(error);
    if (error instanceof TenantError) return handleRouteError(error);
    console.error('Error moving deal stage:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
