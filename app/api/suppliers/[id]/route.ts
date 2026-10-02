import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';

export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = (await routeContext!.params).id as string;
  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === 'string') data.name = body.name.trim();
  if (typeof body.email === 'string') data.email = body.email.trim();
  if (typeof body.phone === 'string') data.phone = body.phone.trim();
  if (typeof body.address === 'string') data.address = body.address.trim();
  if (body.rating === null || body.rating === '') {
    data.rating = null;
  } else if (body.rating !== undefined) {
    const rating = Number(body.rating);
    if (Number.isNaN(rating) || rating < 0 || rating > 5) {
      return NextResponse.json({ error: 'rating must be between 0 and 5' }, { status: 400 });
    }
    data.rating = rating;
  }
  if ((data.name === '' || data.email === '' || data.phone === '' || data.address === '')) {
    return NextResponse.json(
      { error: 'name, email, phone, and address cannot be empty' },
      { status: 400 }
    );
  }

  const updated = await prisma.supplier.updateMany({
    where: { id, companyId },
    data,
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
  }
  const supplier = await prisma.supplier.findFirst({ where: { id, companyId } });
  return jsonOk(supplier);
});

export const DELETE = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = (await routeContext!.params).id as string;
  const deleted = await prisma.supplier.deleteMany({ where: { id, companyId } });
  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
  }
  return jsonOk({ success: true });
});
