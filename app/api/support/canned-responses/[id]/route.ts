import { NextRequest, NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isFeatureEnabled } from '@/lib/feature-modules';
import { TenantError } from '@/lib/auth/company-membership';
import { requireStaffCompanyScope } from '@/lib/tenant/scope-staff-query';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';

async function assertCannedAccess(session: Session, req: NextRequest, id: string) {
  const companyId = await requireStaffCompanyScope(session, req);
  const existing = await prisma.supportCannedResponse.findFirst({
    where: {
      id,
      OR: [{ companyId }, { companyId: null, isShared: true }],
    },
  });
  if (!existing) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (existing.companyId && existing.companyId !== companyId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { companyId, existing };
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user || !role || !['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const enabled = await isFeatureEnabled(session.user.id, 'SUPPORT_CANNED');
    if (!enabled) {
      return NextResponse.json(
        { error: 'Canned responses are not included in your plan' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const access = await assertCannedAccess(session, req, id);
    if ('error' in access && access.error) return access.error;

    const body = await req.json();
    const data: { title?: string; body?: string; category?: string | null; isShared?: boolean } =
      {};
    if (typeof body.title === 'string') {
      if (!body.title.trim()) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
      }
      data.title = body.title.trim();
    }
    if (typeof body.body === 'string') {
      if (!body.body.trim()) {
        return NextResponse.json({ error: 'Body is required' }, { status: 400 });
      }
      data.body = body.body.trim();
    }
    if (body.category !== undefined) {
      data.category = typeof body.category === 'string' ? body.category.trim() || null : null;
    }
    if (typeof body.isShared === 'boolean') data.isShared = body.isShared;

    const response = await prisma.supportCannedResponse.update({
      where: { id },
      data,
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (!isApiException(error)) {
      console.error('[api/support/canned-responses/[id] PATCH]', error);
    }
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user || !role || !['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const enabled = await isFeatureEnabled(session.user.id, 'SUPPORT_CANNED');
    if (!enabled) {
      return NextResponse.json(
        { error: 'Canned responses are not included in your plan' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const access = await assertCannedAccess(session, req, id);
    if ('error' in access && access.error) return access.error;

    await prisma.supportCannedResponse.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (!isApiException(error)) {
      console.error('[api/support/canned-responses/[id] DELETE]', error);
    }
    return handleApiError(error);
  }
}
