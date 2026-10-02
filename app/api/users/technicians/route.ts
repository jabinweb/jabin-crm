import { NextResponse } from 'next/server';
import { withTenantRoute } from '@/lib/api/with-route';
import { prisma } from '@/lib/prisma';
import { workspaceStaffWhere } from '@/lib/auth/workspace-staff';

/** Technicians of the current workspace only (was: every technician on the platform). */
export const GET = withTenantRoute(async (_request, { companyId }) => {
    const technicians = await prisma.user.findMany({
        where: {
            ...workspaceStaffWhere(companyId),
            role: 'TECHNICIAN',
        },
        select: {
            id: true,
            name: true,
            email: true
        },
        orderBy: {
            name: 'asc'
        }
    });

    return NextResponse.json(technicians);
});
