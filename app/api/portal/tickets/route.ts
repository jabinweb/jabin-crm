import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user || session.user.role !== 'CUSTOMER' || !session.user.customerId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tickets = await prisma.supportTicket.findMany({
            where: { customerId: session.user.customerId },
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
