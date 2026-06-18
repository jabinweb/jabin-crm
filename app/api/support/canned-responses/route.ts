import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { TenantError } from '@/lib/auth/company-membership';
import {
  requireStaffCompanyScope,
  resolveOptionalStaffCompanyScope,
} from '@/lib/tenant/scope-staff-query';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'SUPPORT_CANNED');

    const companyId = await resolveOptionalStaffCompanyScope(session, req);

    const responses = await prisma.supportCannedResponse.findMany({
      where: companyId
        ? { OR: [{ companyId }, { companyId: null, isShared: true }] }
        : { isShared: true },
      orderBy: { title: 'asc' },
      take: 100,
    });

    return NextResponse.json(responses);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[api/support/canned-responses GET]', error);
    return NextResponse.json({ error: 'Failed to load canned responses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user || !role || !['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'SUPPORT_CANNED');

    const companyId = await requireStaffCompanyScope(session, req);
    const body = await req.json();
    if (!body.title?.trim() || !body.body?.trim()) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    const response = await prisma.supportCannedResponse.create({
      data: {
        title: body.title.trim(),
        body: body.body.trim(),
        category: body.category,
        isShared: body.isShared ?? true,
        createdById: session.user.id,
        companyId,
      },
    });

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[api/support/canned-responses POST]', error);
    return NextResponse.json({ error: 'Failed to create canned response' }, { status: 500 });
  }
}
