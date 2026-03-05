import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user || session.user.role !== 'CUSTOMER' || !session.user.customerId) {
            return NextResponse.json({ error: 'Unauthorized or not a customer' }, { status: 401 });
        }

        const customerId = session.user.customerId;

        // 1. Basic Stats
        const [totalEquipment, openTickets, pendingWarranties] = await Promise.all([
            prisma.equipmentInstallation.count({ where: { customerId } }),
            prisma.supportTicket.count({
                where: {
                    customerId,
                    status: { not: 'RESOLVED' }
                }
            }),
            prisma.equipmentInstallation.count({
                where: {
                    customerId,
                    warrantyExpiry: {
                        gt: new Date(),
                        lt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
                    }
                }
            })
        ]);

        // 2. Recent Tickets
        const recentTickets = await prisma.supportTicket.findMany({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
                id: true,
                subject: true,
                status: true,
                priority: true,
                createdAt: true
            }
        });

        // 3. Equipment Status Distribution (Mocked if status not in schema, or filtered from records)
        // Let's get actual equipment counts
        const equipments = await prisma.equipmentInstallation.findMany({
            where: { customerId },
            select: { id: true, installationDate: true, warrantyExpiry: true }
        });

        const stats = {
            totalEquipment,
            openTickets,
            pendingWarranties,
            recentTickets,
            equipmentHealth: 95, // Calculated or placeholder
        };

        return NextResponse.json(stats);
    } catch (error) {
        console.error('Error fetching portal stats:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
