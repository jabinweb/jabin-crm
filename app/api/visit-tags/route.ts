import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureVisitTags } from '@/lib/crm/visit-tags';
import { requireStaffCompanyScope } from '@/lib/tenant/scope-staff-query';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';
import { TenantError } from '@/lib/auth/company-membership';

export const GET = withStaffRoute(async (request, ctx) => {
  try {
    const companyId = await requireStaffCompanyScope(ctx.session, request);
    const tags = await ensureVisitTags(companyId);
    return jsonOk({ tags });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});

export const POST = withStaffRoute(async (request, ctx) => {
  try {
    const companyId = await requireStaffCompanyScope(ctx.session, request);
    await ensureVisitTags(companyId);

    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    }

    const tag = await prisma.visitTag.create({
      data: {
        companyId,
        name,
        color: body.color?.trim() || null,
        isSystem: false,
      },
    });

    return jsonOk(tag, { status: 201 });
  } catch (error: any) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 });
    }
    throw error;
  }
});
