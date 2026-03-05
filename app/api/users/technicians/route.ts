import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const technicians = await prisma.user.findMany({
            where: {
                role: 'TECHNICIAN'
            },
            select: {
                id: true,
                name: true,
                email: true
            },
            orderBy: {
                name: 'asc'
            }
        });

        return NextResponse.json(technicians);
    } catch (error) {
        console.error('Error fetching technicians:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
