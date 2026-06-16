import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolvePortalDataAccess } from '@/lib/api/portal-access';

export async function GET() {
    try {
        const session = await auth();
        const access = resolvePortalDataAccess(session);

        if (!access.ok) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (access.scope === 'staff') {
            return NextResponse.json([]);
        }

        const tickets = await prisma.supportTicket.findMany({
            where: { customerId: access.customerId },
            orderBy: { createdAt: 'desc' },
            include: {
                assignedTechnician: {
                    select: { name: true }
                }
            }
        });

        return NextResponse.json(tickets);
    } catch (error) {
        console.error('Error fetching portal tickets:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
