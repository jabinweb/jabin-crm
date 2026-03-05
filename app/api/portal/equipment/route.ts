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
