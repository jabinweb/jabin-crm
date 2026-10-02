import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolvePortalDataAccess } from '@/lib/api/portal-access';
import { prisma } from '@/lib/prisma';
import {
  resolveWorkspaceConfig,
  workspaceSettingsFromCompanySettings,
} from '@/lib/workspace-config';
import { INDUSTRY_PICKER_OPTIONS } from '@/lib/industry-aliases';
import { parseSupportSettings } from '@/lib/support/ticket-types';

export async function GET() {
  try {
    const session = await auth();
    // Staff previewing the portal see their own workspace's configuration
    const staffPreview = resolvePortalDataAccess(session);
    const staffCompanyId =
      staffPreview.ok && staffPreview.scope === 'staff' ? session?.user?.companyId ?? null : null;
    if (!session?.user?.customerId && !staffCompanyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customer = staffCompanyId
      ? {
          companyId: staffCompanyId,
          company: await prisma.company.findUnique({
            where: { id: staffCompanyId },
            select: { settings: true, name: true },
          }),
        }
      : await prisma.customer.findUnique({
          where: { id: session!.user!.customerId! },
          select: { companyId: true, company: { select: { settings: true, name: true } } },
        });

    if (!customer?.companyId) {
      return NextResponse.json({ error: 'Customer not linked to a company' }, { status: 404 });
    }

    const stored =
      customer.company?.settings &&
      typeof customer.company.settings === 'object' &&
      !Array.isArray(customer.company.settings)
        ? (customer.company.settings as Record<string, unknown>)
        : {};

    const workspaceSettings = workspaceSettingsFromCompanySettings(stored);
    const supportSettings = parseSupportSettings(stored.support);
    const config = resolveWorkspaceConfig(workspaceSettings);

    return NextResponse.json({
      companyId: customer.companyId,
      companyName: customer.company?.name,
      workspace: workspaceSettings,
      config,
      support: supportSettings,
      templates: INDUSTRY_PICKER_OPTIONS,
    });
  } catch (error) {
    console.error('[api/portal/workspace-config]', error);
    return NextResponse.json({ error: 'Failed to load workspace configuration' }, { status: 500 });
  }
}
