import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { dealService } from '@/lib/crm/deal-service';
import { prisma } from '@/lib/prisma';
import { rejectIfOutsideCompanyPipeline } from '@/lib/pipelines/assert-stage';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await withModuleAccess('DEALS');

    const params = await context.params;
    const body = await req.json();

    if (body.stage) {
      const existing = await prisma.deal.findUnique({
        where: { id: params.id },
        select: { lead: { select: { companyId: true } } },
      });
      const rejected = await rejectIfOutsideCompanyPipeline(
        existing?.lead?.companyId,
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
