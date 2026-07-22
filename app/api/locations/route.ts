import { handleRouteError } from '@/lib/api/tenant-response';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { asNextRequest } from '@/lib/api/as-next-request';
import {
  resolveCompanyContextFromRequest,
} from '@/lib/auth/company-membership';
import { hasLegacyRole } from '@/lib/auth/permissions';

const LOCATION_TYPES = new Set(['WAREHOUSE', 'STORE', 'VAN']);

function buildLocationCode(companyId: string, rawCode?: string, type?: string): string {
  const prefix = companyId.slice(0, 8);
  const base = (rawCode?.trim() || type?.trim() || 'LOC').toUpperCase().replace(/\s+/g, '-');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${base}-${suffix}`;
}

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
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. Admin only.' }, { status: 403 });
    }

    const { companyId } = await resolveCompanyContextFromRequest(
      session,
      asNextRequest(request)
    );

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const type = typeof body.type === 'string' ? body.type.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const rawCode = typeof body.code === 'string' ? body.code.trim() : '';

    if (!name || !type || !address) {
      return NextResponse.json(
        { error: 'name, type, and address are required' },
        { status: 400 }
      );
    }

    // Prefer known types; still allow custom string values.
    const locationType = LOCATION_TYPES.has(type.toUpperCase())
      ? type.toUpperCase()
      : type;

    let code = buildLocationCode(companyId, rawCode || undefined, locationType);
    let location = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        location = await prisma.location.create({
          data: {
            name,
            type: locationType,
            address,
            code,
            companyId,
          },
          select: {
            id: true,
            name: true,
            type: true,
            code: true,
            address: true,
          },
        });
        break;
      } catch (err: unknown) {
        const isUnique =
          err &&
          typeof err === 'object' &&
          'code' in err &&
          (err as { code: string }).code === 'P2002';
        if (!isUnique || attempt === 2) throw err;
        code = buildLocationCode(companyId, rawCode || undefined, locationType);
      }
    }

    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
