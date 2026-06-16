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

        const equipment = await prisma.equipmentInstallation.findMany({
            where: { customerId: access.customerId },
            orderBy: { installationDate: 'desc' },
            include: {
                product: {
                    select: {
                        name: true,
                        category: true
                    }
                }
            }
        });

        return NextResponse.json(equipment);
    } catch (error) {
        console.error('Error fetching portal equipment:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
