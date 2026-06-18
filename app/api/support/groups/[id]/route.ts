import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user || !role || !['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'SUPPORT_GROUPS');

    const { companyId } = await resolveCompanyContextFromRequest(session, req);
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.supportGroup.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const group = await prisma.$transaction(async (tx) => {
      if (Array.isArray(body.memberIds)) {
        await tx.supportGroupMember.deleteMany({ where: { groupId: id } });
        if (body.memberIds.length) {
          await tx.supportGroupMember.createMany({
            data: body.memberIds.map((userId: string) => ({ groupId: id, userId })),
          });
        }
      }

      return tx.supportGroup.update({
        where: { id },
        data: {
          name: body.name?.trim() ?? undefined,
          description: body.description,
          email: body.email,
          isDefault: body.isDefault,
        },
        include: {
          members: {
            include: { user: { select: { id: true, name: true, email: true, role: true } } },
          },
        },
      });
    });

    return NextResponse.json(group);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[api/support/groups PATCH]', error);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user || !role || !['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'SUPPORT_GROUPS');

    const { companyId } = await resolveCompanyContextFromRequest(session, req);
    const { id } = await params;

    const existing = await prisma.supportGroup.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    await prisma.supportGroup.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[api/support/groups DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
