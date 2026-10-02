import { handleRouteError } from '@/lib/api/tenant-response';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listSlaPolicies, upsertSlaPolicy } from '@/lib/crm/sla-policies';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';
import { TicketPriority } from '@prisma/client';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'SUPPORT_SLA');

    let companyId: string | null = null;
    try {
      const ctx = await resolveCompanyContextFromRequest(session, request);
      companyId = ctx.companyId;
    } catch (e) {
      if (!(e instanceof TenantError) || e.status !== 400) throw e;
    }

    const policies = await listSlaPolicies(companyId);
    return NextResponse.json({ policies });
  } catch (error) {
    return handleRouteError(error);
    const handled = handleApiError(error);
    if (handled.status !== 500) return handled;
    console.error('[api/support/sla-policies GET]', error);
    return NextResponse.json({ error: 'Failed to load SLA policies' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user || !role || !['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'SUPPORT_SLA');

    let companyId: string | null = null;
    try {
      const ctx = await resolveCompanyContextFromRequest(session, request);
      companyId = ctx.companyId;
    } catch (e) {
      if (!(e instanceof TenantError) || e.status !== 400) throw e;
    }

    const body = await request.json();
    const priority = body.priority as TicketPriority;
    if (!priority || !body.name || body.responseHours == null || body.resolutionHours == null) {
      return NextResponse.json({ error: 'Invalid SLA policy payload' }, { status: 400 });
    }
    const responseHours = Number(body.responseHours);
    const resolutionHours = Number(body.resolutionHours);
    if (
      !Object.values(TicketPriority).includes(priority) ||
      !Number.isFinite(responseHours) ||
      !Number.isFinite(resolutionHours) ||
      responseHours <= 0 ||
      resolutionHours <= 0
    ) {
      return NextResponse.json({ error: 'Invalid SLA policy payload' }, { status: 400 });
    }
    // Without a workspace this would overwrite the platform-wide default policy.
    if (!companyId && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Company context required' }, { status: 400 });
    }

    const policy = await upsertSlaPolicy({
      companyId,
      priority,
      name: body.name,
      responseHours,
      resolutionHours,
    });

    return NextResponse.json(policy);
  } catch (error) {
    return handleRouteError(error);
    console.error('[api/support/sla-policies POST]', error);
    return NextResponse.json({ error: 'Failed to save SLA policy' }, { status: 500 });
  }
}
