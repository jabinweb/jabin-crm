import { handleRouteError } from '@/lib/api/tenant-response';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'SUPPORT_GROUPS');

    let companyId: string | undefined;
    try {
      const ctx = await resolveCompanyContextFromRequest(session, req);
      companyId = ctx.companyId;
    } catch (e) {
      if (e instanceof TenantError) {
        if (session.user.role !== 'SUPER_ADMIN') {
          return NextResponse.json({ error: e.message }, { status: e.status });
        }
      } else {
        throw e;
      }
    }

    if (!companyId && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Company context required' }, { status: 400 });
    }

    const groups = await prisma.supportGroup.findMany({
      where: companyId ? { companyId } : undefined,
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        _count: { select: { tickets: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(groups);
  } catch (error) {
    console.error('[api/support/groups GET]', error);
    return NextResponse.json({ error: 'Failed to load groups' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user || !role || !['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'SUPPORT_GROUPS');

    const { companyId } = await resolveCompanyContextFromRequest(session, req);
    const body = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    const group = await prisma.supportGroup.create({
      data: {
        name: body.name.trim(),
        description: body.description,
        email: body.email,
        companyId: companyId,
        isDefault: body.isDefault ?? false,
        members: body.memberIds?.length
          ? {
              create: body.memberIds.map((userId: string) => ({ userId })),
            }
          : undefined,
      },
      include: { members: true },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
    console.error('[api/support/groups POST]', error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}
