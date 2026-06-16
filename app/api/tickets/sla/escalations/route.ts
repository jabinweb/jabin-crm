import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { ApiErrors, handleApiError } from '@/lib/api-error-handler';
import { slaService } from '@/lib/crm/sla-service';
import { guardSlaAccess } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';

function isPrivilegedRole(role: string) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'SUPPORT_MANAGER';
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await guardSlaAccess(session.user);
    if (!isPrivilegedRole(session.user.role)) {
      throw ApiErrors.forbidden();
    }

    const breached = await slaService.getBreachedActiveTickets(100);
    return NextResponse.json({
      total: breached.length,
      tickets: breached,
    });
  } catch (error) {
    if (!isApiException(error)) {
      console.error('[api/tickets/sla/escalations]', error);
    }
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await guardSlaAccess(session.user);
    if (!isPrivilegedRole(session.user.role)) {
      throw ApiErrors.forbidden();
    }

    const result = await slaService.runEscalationSweep();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (!isApiException(error)) {
      console.error('[api/tickets/sla/escalations]', error);
    }
    return handleApiError(error);
  }
}
