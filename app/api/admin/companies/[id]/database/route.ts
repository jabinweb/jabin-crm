import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { UserRole } from '@prisma/client';
import {
  getCompanyDatabaseStatus,
} from '@/lib/tenancy/company-database';
import {
  DATABASE_ACTIONS,
  runCompanyDatabaseAction,
  type DatabaseAction,
} from '@/lib/tenancy/database-actions';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const companyId = id?.trim();
    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'Invalid company ID' },
        { status: 400 }
      );
    }

    const status = await getCompanyDatabaseStatus(companyId);
    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load database status';
    const status = message === 'Company not found' ? 404 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const companyId = id?.trim();
    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'Invalid company ID' },
        { status: 400 }
      );
    }

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
