import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { workspaceStaffWhere } from '@/lib/auth/workspace-staff';

export const GET = withTenantRoute(async (req, { session, userId, companyId }) => {
  if (session.user.role === 'CUSTOMER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureFeatureEnabled(userId, 'SERVICE_GPS');
  const parsed = parseInt(req.nextUrl.searchParams.get('hours') || '8', 10);
  const hours = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 24 * 30) : 8;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  // Only technicians who belong to this workspace.
  const logs = await prisma.technicianLocationLog.findMany({
    where: { capturedAt: { gte: since }, technician: workspaceStaffWhere(companyId) },
    include: {
      technician: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { capturedAt: 'desc' },
  });

  const latestByTechnician = new Map<string, (typeof logs)[number]>();
  for (const log of logs) {
    if (!latestByTechnician.has(log.technicianId)) {
      latestByTechnician.set(log.technicianId, log);
    }
  }

  return jsonOk(Array.from(latestByTechnician.values()));
});
