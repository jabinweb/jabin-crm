import { handleRouteError } from '@/lib/api/tenant-response';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';
import {
  parseAutomationRules,
  DEFAULT_AUTOMATION_RULES,
  type AutomationRule,
} from '@/lib/support/automation-rules';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'TICKETS');

    const { companyId } = await resolveCompanyContextFromRequest(session, req);
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true },
    });

    const stored =
      company?.settings && typeof company.settings === 'object' && !Array.isArray(company.settings)
        ? (company.settings as Record<string, unknown>)
        : {};
    const support = stored.support as Record<string, unknown> | undefined;
    const rules = parseAutomationRules(support?.automation);

    return NextResponse.json({
      rules: rules.length > 0 ? rules : DEFAULT_AUTOMATION_RULES,
      defaults: DEFAULT_AUTOMATION_RULES,
    });
  } catch (error) {
    return handleRouteError(error);
    console.error('[api/support/automation-rules GET]', error);
    return NextResponse.json({ error: 'Failed to load rules' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user || !role || !['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'TICKETS');

    const { companyId } = await resolveCompanyContextFromRequest(session, req);
    const body = await req.json();
    const rules = body.rules as AutomationRule[];
    if (!Array.isArray(rules)) {
      return NextResponse.json({ error: 'rules array required' }, { status: 400 });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true },
    });

    const stored =
      company?.settings && typeof company.settings === 'object' && !Array.isArray(company.settings)
        ? ({ ...(company.settings as Record<string, unknown>) })
        : {};

    stored.support = {
      ...(typeof stored.support === 'object' && !Array.isArray(stored.support)
        ? stored.support
        : {}),
      automation: { rules },
    };

    await prisma.company.update({
      where: { id: companyId },
      data: { settings: stored },
    });

    return NextResponse.json({ rules });
  } catch (error) {
    return handleRouteError(error);
    console.error('[api/support/automation-rules PUT]', error);
    return NextResponse.json({ error: 'Failed to save rules' }, { status: 500 });
  }
}
