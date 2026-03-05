import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { customerId: true, role: true },
        });

        // SUPER_ADMIN / ADMIN can see all service reports
        const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

        const reports = await prisma.serviceReport.findMany({
            where: isAdmin ? {} : (user?.customerId ? {
                ticket: { customerId: user.customerId }
            } : { id: '__none__' }),
            include: {
                technician: { select: { id: true, name: true } },
                ticket: {
                    select: {
                        id: true,
                        subject: true,
                        status: true,
                        customerId: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(reports);
    } catch (error) {
        console.error('[api/portal/service-history] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
