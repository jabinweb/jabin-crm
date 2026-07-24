import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { dealService } from '@/lib/crm/deal-service';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';

function isCompanyAdmin(role?: string) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export async function GET(req: NextRequest) {
  try {
    const session = await withModuleAccess('DEALS');

    let companyId: string | undefined;
    if (isCompanyAdmin(session.user.role)) {
      try {
        const ctx = await resolveCompanyContextFromRequest(session, req);
        companyId = ctx.companyId;
      } catch {
        /* fall back to user-scoped */
      }
    }

    const stats = await dealService.getPipelineStats(session.user.id, companyId);
    return NextResponse.json(stats);
  } catch (error: any) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error fetching pipeline stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
