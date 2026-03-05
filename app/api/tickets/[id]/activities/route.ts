import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ticketService } from '@/lib/crm/ticket-service';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { comment } = await request.json();
        const userId = session.user.id;

        if (!comment) {
            return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
        }

        const activity = await ticketService.addComment(id, comment, userId);

        return NextResponse.json(activity, { status: 201 });
    } catch (error) {
        console.error('Error adding ticket comment:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
