import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';
import { prisma } from '@/lib/prisma';
import {
  parseWorkspaceSettings,
  resolveWorkspaceConfig,
} from '@/lib/workspace-config';
import { BUSINESS_VERTICAL_OPTIONS } from '@/lib/workspace-templates';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req);

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true },
    });

    const stored =
      company?.settings && typeof company.settings === 'object' && !Array.isArray(company.settings)
        ? (company.settings as Record<string, unknown>)
        : {};

    const workspaceSettings = parseWorkspaceSettings(stored.workspace);
    const config = resolveWorkspaceConfig(workspaceSettings);

    return NextResponse.json({
      workspace: workspaceSettings,
      config,
      templates: BUSINESS_VERTICAL_OPTIONS,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json(
        { error: error.message, ...(error.code ? { code: error.code } : {}) },
        { status: error.status }
      );
    }
    console.error('[workspace/config]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
