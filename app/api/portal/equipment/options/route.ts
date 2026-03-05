import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user || session.user.role !== 'CUSTOMER' || !session.user.customerId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const equipment = await prisma.equipmentInstallation.findMany({
            where: { customerId: session.user.customerId },
            select: {
                id: true,
                serialNumber: true,
                product: {
                    select: { name: true }
                }
            }
        });

        const options = equipment.map(e => ({
            id: e.id,
            label: `${e.product?.name} (SN: ${e.serialNumber})`
        }));

        return NextResponse.json(options);
    } catch (error) {
        console.error('Error fetching portal equipment options:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
