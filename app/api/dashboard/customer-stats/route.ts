import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Basic Counts
        const totalCustomers = await prisma.customer.count();
        const totalEquipment = await prisma.equipmentInstallation.count();
        const activeTickets = await prisma.supportTicket.count({
            where: { NOT: { status: { in: ['RESOLVED', 'CLOSED'] } } }
        });

        // 2. Customers by City (Segmentation)
        const cityDistribution = await prisma.customer.groupBy({
            by: ['city'],
            _count: {
                id: true
            },
            orderBy: {
                _count: {
                    id: 'desc'
                }
            },
            take: 5
        });

        // 3. Equipment Status Breakdown
        const equipmentStatus = await prisma.equipmentInstallation.groupBy({
            by: ['status'],
            _count: {
                id: true
            }
        });

        // 4. Hospitals with most tickets (Density)
        const highDemandHospitals = await prisma.customer.findMany({
            include: {
                _count: {
                    select: { supportTickets: true }
                }
            },
            orderBy: {
                supportTickets: {
                    _count: 'desc'
                }
            },
            take: 5
        });

        // 5. Recent Activity
        const recentActivity = await prisma.customerActivity.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
                customer: {
                    select: { hospitalName: true }
                }
            }
        });

        // 6. Upcoming Warranty Expiries
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        const upcomingExpiries = await prisma.equipmentInstallation.findMany({
            where: {
                warrantyExpiry: {
                    lte: nextMonth,
                    gte: new Date()
                }
            },
            include: {
                customer: { select: { hospitalName: true } },
                product: { select: { name: true } }
            },
            take: 5
        });

        return NextResponse.json({
            summary: {
                totalCustomers,
                totalEquipment,
                activeTickets
            },
            cityDistribution: cityDistribution.map(c => ({
                name: c.city || 'Unknown',
                count: c._count.id
            })),
            equipmentStatus: equipmentStatus.map(s => ({
                status: s.status,
                count: s._count.id
            })),
            highDemandHospitals: highDemandHospitals.map(h => ({
                name: h.hospitalName,
                ticketCount: h._count.supportTickets
            })),
            recentActivity,
            upcomingExpiries
        });
    } catch (error) {
        console.error('Error fetching customer analytics:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
