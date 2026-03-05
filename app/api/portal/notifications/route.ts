import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { notificationService } from '@/lib/crm/notification-service';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const notifications = await notificationService.getForUser(session.user.id);
        return NextResponse.json(notifications);
    } catch (error) {
        console.error('[api/portal/notifications GET]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();

        if (body.all === true) {
            await notificationService.markAllRead(session.user.id);
            return NextResponse.json({ success: true });
        }

        if (body.id) {
            const updated = await notificationService.markRead(body.id);
            return NextResponse.json(updated);
        }

        return NextResponse.json({ error: 'Provide id or all:true' }, { status: 400 });
    } catch (error) {
        console.error('[api/portal/notifications PATCH]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
