import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withTenantRoute(async (_request, { companyId }) => {
  const assets = await prisma.asset.findMany({
    where: { companyId },
    orderBy: { purchaseDate: 'desc' },
  });
  return jsonOk(assets);
});

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const type = typeof body.type === 'string' ? body.type.trim() : '';
  const value = Number(body.value);
  const depreciation = Number(body.depreciation ?? 0);
  const purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : new Date();

  if (!name || !type || Number.isNaN(value) || value < 0) {
    return NextResponse.json(
      { error: 'name, type, and a valid value are required' },
      { status: 400 }
    );
  }
  if (Number.isNaN(depreciation) || depreciation < 0) {
    return NextResponse.json({ error: 'depreciation must be a non-negative number' }, { status: 400 });
  }
  if (Number.isNaN(purchaseDate.getTime())) {
    return NextResponse.json({ error: 'Invalid purchaseDate' }, { status: 400 });
  }

  const asset = await prisma.asset.create({
    data: { name, type, value, depreciation, purchaseDate, companyId },
  });

  return jsonOk(asset, { status: 201 });
});
