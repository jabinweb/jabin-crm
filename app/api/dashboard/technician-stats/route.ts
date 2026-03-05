import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session || session.user.role !== 'TECHNICIAN') {
            return NextResponse.json({ error: 'Unauthorized. Technician role required.' }, { status: 401 });
        }

        const technicianId = session.user.id;

        const [assigned, pending, resolved, recentReports] = await Promise.all([
            // 1. Total assigned tickets (all active)
            prisma.supportTicket.count({
                where: { assignedTechnicianId: technicianId, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
            }),
            // 2. Pending (specifically OPEN or ASSIGNED but not yet working)
            prisma.supportTicket.count({
                where: { assignedTechnicianId: technicianId, status: 'ASSIGNED' },
            }),
            // 3. Resolved by this technician
            prisma.supportTicket.count({
                where: { assignedTechnicianId: technicianId, status: 'RESOLVED' },
            }),
            // 4. Recent service reports by this technician
            prisma.serviceReport.findMany({
                where: { technicianId },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: {
                    ticket: { select: { subject: true } },
                },
            }),
        ]);

        return NextResponse.json({
            stats: {
                assigned,
                pending,
                resolved,
                totalCompleted: resolved, // Simplified for now
            },
            recentReports,
        });
    } catch (error) {
        console.error('Error fetching technician stats:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
