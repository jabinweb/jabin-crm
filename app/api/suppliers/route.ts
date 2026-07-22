import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withTenantRoute(async (_request, { companyId }) => {
  const suppliers = await prisma.supplier.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
  });
  return jsonOk(suppliers);
});

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const rating =
    body.rating !== undefined && body.rating !== null && body.rating !== ''
      ? Number(body.rating)
      : undefined;

  if (!name || !email || !phone || !address) {
    return NextResponse.json(
      { error: 'name, email, phone, and address are required' },
      { status: 400 }
    );
  }

  if (rating !== undefined && (Number.isNaN(rating) || rating < 0 || rating > 5)) {
    return NextResponse.json({ error: 'rating must be between 0 and 5' }, { status: 400 });
  }

  try {
    const supplier = await prisma.supplier.create({
      data: {
        name,
        email,
        phone,
        address,
        rating: rating ?? null,
        companyId,
      },
    });
    return jsonOk(supplier, { status: 201 });
  } catch (err: unknown) {
    const isUnique =
      err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002';
    if (isUnique) {
      return NextResponse.json(
        { error: 'A supplier with this email already exists' },
        { status: 409 }
      );
    }
    throw err;
  }
});
