import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, UserStatus } from '@prisma/client';

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== UserRole.SUPER_ADMIN) {
    return null;
  }
  return session;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await requireSuperAdmin();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    const body = await request.json();
    const data: {
      name?: string | null;
      email?: string;
      role?: UserRole;
      userStatus?: UserStatus;
    } = {};

    if (typeof body.name === 'string') data.name = body.name.trim() || null;
    if (typeof body.email === 'string' && body.email.trim()) {
      data.email = body.email.trim().toLowerCase();
    }
    if (typeof body.role === 'string' && Object.values(UserRole).includes(body.role as UserRole)) {
      if (body.role === UserRole.SUPER_ADMIN) {
        return NextResponse.json(
          { success: false, error: 'Cannot assign SUPER_ADMIN via this endpoint' },
          { status: 400 }
        );
      }
      data.role = body.role as UserRole;
    }
    if (
      typeof body.status === 'string' &&
      Object.values(UserStatus).includes(body.status as UserStatus)
    ) {
      data.userStatus = body.status as UserStatus;
    }
    if (
      typeof body.userStatus === 'string' &&
      Object.values(UserStatus).includes(body.userStatus as UserStatus)
    ) {
      data.userStatus = body.userStatus as UserStatus;
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    if (existing.role === UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, error: 'Cannot edit SUPER_ADMIN users here' },
        { status: 403 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        userStatus: true,
        createdAt: true,
        primaryCompany: { select: { id: true, name: true, status: true } },
        userCompanies: {
          select: { company: { select: { id: true, name: true, status: true } } },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        status: updated.userStatus,
        companies: updated.userCompanies.map((uc) => uc.company),
      },
    });
  } catch (error) {
    console.error('[API] Update user error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await requireSuperAdmin();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    if (existing.role === UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete SUPER_ADMIN' },
        { status: 403 }
      );
    }

    // Detach company FKs that may Restrict, then delete user (cascades accounts/sessions)
    await prisma.$transaction(async (tx) => {
      await tx.userCompany.deleteMany({ where: { userId } });
      await tx.userCompanyRole.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          companyId: null,
          primaryCompanyId: null,
          managedCompanyId: null,
          customerId: null,
        },
      });
      // Null out assignee FKs that might block
      await tx.lead.updateMany({
        where: { assignedToId: userId },
        data: { assignedToId: null },
      });
      await tx.supportTicket.updateMany({
        where: { assignedToId: userId },
        data: { assignedToId: null },
      });
      await tx.project.updateMany({
        where: { pmUserId: userId },
        data: { pmUserId: null },
      });
      await tx.projectTask.updateMany({
        where: { assigneeId: userId },
        data: { assigneeId: null },
      });
      await tx.projectTask.updateMany({
        where: { reporterId: userId },
        data: { reporterId: null },
      });
      await tx.employee.updateMany({
        where: { userId },
        data: { userId: null },
      });
      await tx.user.delete({ where: { id: userId } });
    });

    return NextResponse.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('[API] Delete user error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete user';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
