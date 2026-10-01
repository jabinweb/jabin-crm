import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { UserRole } from '@prisma/client';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import { normalizeAuthEmail } from '@/lib/auth/normalize-email';
import { sendWorkspaceInviteEmail } from '@/lib/email/workspace-invite';

const INVITE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.SALES,
  UserRole.SUPPORT_MANAGER,
  UserRole.TECHNICIAN,
];

/**
 * Invite / add a teammate to the current workspace.
 * Creates a user (or links an existing one) and UserCompany membership.
 */
export const POST = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeAuthEmail(String(body.email || '').trim());
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const roleRaw = String(body.role || 'SALES').toUpperCase() as UserRole;
  const role = INVITE_ROLES.includes(roleRaw) ? roleRaw : UserRole.SALES;
  const password =
    typeof body.password === 'string' && body.password.length >= 8
      ? body.password
      : randomBytes(10).toString('base64url');

  if (!email) {
    return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: 'Enter a valid email' }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });
  const inviterName = session.user.name || session.user.email || 'An admin';

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      userStatus: true,
      primaryCompanyId: true,
    },
  });

  if (existing) {
    if (existing.role === UserRole.SUPER_ADMIN || existing.role === UserRole.CUSTOMER) {
      return NextResponse.json(
        { success: false, error: 'Cannot invite this account type to the workspace' },
        { status: 400 }
      );
    }

    await prisma.userCompany.upsert({
      where: {
        userId_companyId: { userId: existing.id, companyId },
      },
      create: { userId: existing.id, companyId },
      update: {},
    });

    if (!existing.primaryCompanyId) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { primaryCompanyId: companyId, companyId },
      });
    }

    const emailSent = await sendWorkspaceInviteEmail({
      email: existing.email,
      name: existing.name,
      companyName: company?.name || 'your workspace',
      inviterName,
      role: existing.role,
      isNewAccount: false,
    });

    return jsonOk({
      success: true,
      data: {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        role: existing.role,
        status: existing.userStatus,
        alreadyMember: true,
        temporaryPassword: null,
        emailSent,
      },
    });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name: name || email.split('@')[0],
      role,
      password: hashedPassword,
      userStatus: 'ACTIVE',
      companyId,
      primaryCompanyId: companyId,
      userCompanies: {
        create: { companyId },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      userStatus: true,
    },
  });

  const { ensureRbacCatalog, syncUserRoleAssignment } = await import(
    '@/lib/auth/rbac-catalog'
  );
  await ensureRbacCatalog();
  await syncUserRoleAssignment(user.id, role);

  const emailSent = await sendWorkspaceInviteEmail({
    email: user.email,
    name: user.name,
    companyName: company?.name || 'your workspace',
    inviterName,
    role,
    isNewAccount: true,
  });

  return jsonOk(
    {
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.userStatus,
        alreadyMember: false,
        // Only hand the password to the admin when the invite email could not be delivered
        // (or they typed one themselves) — otherwise the invitee sets their own via the link.
        temporaryPassword: emailSent && !body.password ? null : password,
        emailSent,
      },
    },
    { status: 201 }
  );
});
