import { handleRouteError } from '@/lib/api/tenant-response';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { asNextRequest } from '@/lib/api/as-next-request';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companyId } = await resolveCompanyContextFromRequest(
      session,
      asNextRequest(request)
    );

    const locations = await prisma.location.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        code: true,
        address: true,
      },
    });

    return NextResponse.json(locations);
  } catch (error) {
    return handleRouteError(error);
    console.error('[api/locations GET]', error);
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
  }
}
