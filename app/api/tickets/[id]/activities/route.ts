import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ticketService } from '@/lib/crm/ticket-service';
import { handleApiError } from '@/lib/api-error-handler';
import { guardTicketAccess } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';
import { requireTicketRouteAccess } from '@/lib/tenant/ticket-route-guard';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        await guardTicketAccess(session?.user);

        const guard = await requireTicketRouteAccess(session, request, id);
        if (!guard.ok) return guard.response;

        const { comment, isInternal } = await request.json();
        const userId = guard.session.user.id;
        const isStaff = guard.session.user.role !== 'CUSTOMER';

        if (!comment) {
            return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
        }

        const activity = await ticketService.addComment(
            id,
            comment,
            userId,
            { isInternal: isStaff && !!isInternal }
        );

        return NextResponse.json(activity, { status: 201 });
    } catch (error) {
        if (!isApiException(error)) {
            console.error('Error adding ticket comment:', error);
        }
        return handleApiError(error);
    }
}

