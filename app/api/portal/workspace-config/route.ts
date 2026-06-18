import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  parseWorkspaceSettings,
  resolveWorkspaceConfig,
} from '@/lib/workspace-config';
import { BUSINESS_VERTICAL_OPTIONS } from '@/lib/workspace-templates';
import { parseSupportSettings } from '@/lib/support/ticket-types';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: session.user.customerId },
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

    const workspaceSettings = parseWorkspaceSettings(stored.workspace);
    const supportSettings = parseSupportSettings(stored.support);
    const config = resolveWorkspaceConfig(workspaceSettings);

    return NextResponse.json({
      companyId: customer.companyId,
      companyName: customer.company?.name,
      workspace: workspaceSettings,
      config,
      support: supportSettings,
      templates: BUSINESS_VERTICAL_OPTIONS,
    });
  } catch (error) {
    console.error('[api/portal/workspace-config]', error);
    return NextResponse.json({ error: 'Failed to load workspace configuration' }, { status: 500 });
  }
}
