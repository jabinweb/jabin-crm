import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { handleApiError } from '@/lib/api-error-handler';
import { cashService } from '@/lib/crm/cash-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await ensureFeatureEnabled(session.user.id, 'SERVICE_CASH');
    const balances = await cashService.getTechnicianBalances(session.user.id);
    return NextResponse.json({ balances });
  } catch (error) {
    return handleApiError(error);
  }
}
