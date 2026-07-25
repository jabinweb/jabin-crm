import { handleRouteError } from '@/lib/api/tenant-response';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { asNextRequest } from '@/lib/api/as-next-request';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { hasLegacyRole } from '@/lib/auth/permissions';

const LOCATION_TYPES = new Set(['WAREHOUSE', 'STORE', 'VAN']);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, string> = {};

    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (typeof body.address === 'string' && body.address.trim()) {
      data.address = body.address.trim();
    }
    if (typeof body.type === 'string' && body.type.trim()) {
      const type = body.type.trim();
      data.type = LOCATION_TYPES.has(type.toUpperCase()) ? type.toUpperCase() : type;
    }

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const existing = await prisma.location.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const location = await prisma.location.update({
      where: { id },
      data,
      select: { id: true, name: true, type: true, code: true, address: true },
    });

    return NextResponse.json(location);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;

    const deleted = await prisma.location.deleteMany({ where: { id, companyId } });
    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
