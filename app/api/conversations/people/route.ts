import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute } from '@/lib/api/with-route';
import { workspaceStaffWhere } from '@/lib/auth/workspace-staff';
import { PERSON_SELECT } from '@/lib/messaging/service';

/** Everyone the caller can message in this workspace (for pickers and @mentions). */
export const GET = withTenantRoute(async (_request, { session, companyId }) => {
  const people = await prisma.user.findMany({
    where: { userStatus: 'ACTIVE', ...workspaceStaffWhere(companyId) },
    select: { ...PERSON_SELECT, role: true, lastSeenAt: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ people, me: session.user.id });
});
