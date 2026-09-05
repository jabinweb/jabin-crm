import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { getCompanyDatabaseStatus } from '@/lib/tenancy/company-database';
import {
  DATABASE_ACTIONS,
  runCompanyDatabaseAction,
  type DatabaseAction,
} from '@/lib/tenancy/database-actions';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
      return NextResponse.json(
        { success: false, message: 'Forbidden' },
        { status: 403 }
      );
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req);
    const status = await getCompanyDatabaseStatus(companyId);
    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load database status';
    const statusCode =
      message.includes('Company') || message.includes('company') ? 400 : 500;
    return NextResponse.json(
      { success: false, message },
      { status: statusCode }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
      return NextResponse.json(
        { success: false, message: 'Forbidden' },
        { status: 403 }
      );
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req);
    const body = await req.json().catch(() => ({}));
    const action = body?.action as DatabaseAction;
    if (!action || !DATABASE_ACTIONS.includes(action)) {
      return NextResponse.json(
        {
          success: false,
          message: `action must be one of: ${DATABASE_ACTIONS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const result = await runCompanyDatabaseAction(companyId, {
      action,
      url: typeof body.url === 'string' ? body.url : undefined,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Database action failed';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
