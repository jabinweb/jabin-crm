import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffCompanyScope } from '@/lib/tenant/scope-staff-query';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';
import { TenantError } from '@/lib/auth/company-membership';

export const PATCH = withStaffRoute(async (request, ctx, routeContext) => {
  try {
    const { id } = await routeContext!.params;
    const companyId = await requireStaffCompanyScope(ctx.session, request);

    const existing = await prisma.visitTag.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    const body = await request.json();
    const tag = await prisma.visitTag.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
        ...(body.color !== undefined ? { color: body.color?.trim() || null } : {}),
      },
    });

    return jsonOk(tag);
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

export const DELETE = withStaffRoute(async (request, ctx, routeContext) => {
  try {
    const { id } = await routeContext!.params;
    const companyId = await requireStaffCompanyScope(ctx.session, request);

    const existing = await prisma.visitTag.findFirst({
      where: { id, companyId },
      include: { _count: { select: { visits: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    if (existing.isSystem && existing._count.visits > 0) {
      return NextResponse.json(
        { error: 'System tags in use cannot be deleted' },
        { status: 400 }
      );
    }

    if (existing.isSystem) {
      return NextResponse.json(
        { error: 'System tags cannot be deleted' },
        { status: 400 }
      );
    }

    await prisma.visitTag.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});
