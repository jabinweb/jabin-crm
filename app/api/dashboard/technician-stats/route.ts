import { NextResponse } from 'next/server';
import { endOfMonth, startOfMonth } from 'date-fns';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const technicianId = session.user.id;
        const now = new Date();
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);

        const ticketBase = { assignedTechnicianId: technicianId };

        const [assigned, inProgress, resolved, activeTickets, recentReports] =
            await Promise.all([
                prisma.supportTicket.count({
                    where: {
                        ...ticketBase,
                        status: { in: ['OPEN', 'ASSIGNED'] },
                    },
                }),
                prisma.supportTicket.count({
                    where: { ...ticketBase, status: 'IN_PROGRESS' },
                }),
                prisma.supportTicket.count({
                    where: {
                        ...ticketBase,
                        status: { in: ['RESOLVED', 'CLOSED'] },
                        updatedAt: { gte: monthStart, lte: monthEnd },
                    },
                }),
                prisma.supportTicket.findMany({
                    where: {
                        ...ticketBase,
                        status: { notIn: ['RESOLVED', 'CLOSED'] },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 12,
                    select: {
                        id: true,
                        subject: true,
                        priority: true,
                        status: true,
                        createdAt: true,
                        customer: { select: { organizationName: true } },
                    },
                }),
                prisma.serviceReport.findMany({
                    where: { technicianId },
                    orderBy: { createdAt: 'desc' },
                    take: 6,
                    select: {
                        id: true,
                        serviceNotes: true,
                        createdAt: true,
                        ticket: {
                            select: {
                                subject: true,
                                customer: { select: { organizationName: true } },
                            },
                        },
                    },
                }),
            ]);

        return NextResponse.json({
            counts: {
                assigned,
                inProgress,
                resolved,
            },
            activeTickets,
            recentReports,
        });
    } catch (error) {
        console.error('[api/dashboard/technician-stats]', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
