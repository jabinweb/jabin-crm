import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { dealService } from '@/lib/crm/deal-service';
import { resolveCompanyContextFromRequest, TenantError } from '@/lib/auth/company-membership';
import { handleRouteError } from '@/lib/api/tenant-response';

export async function GET(req: NextRequest) {
  try {
    const session = await withModuleAccess('DEALS');
    const { companyId } = await resolveCompanyContextFromRequest(session, req);

    const analysis = await dealService.getWinLossAnalysis(session.user.id, 90, companyId);
    return NextResponse.json(analysis);
  } catch (error: any) {
    if (isApiException(error)) return handleApiError(error);
    if (error instanceof TenantError) return handleRouteError(error);
    console.error('Error fetching win/loss analysis:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
