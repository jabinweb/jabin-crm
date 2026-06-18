import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ticketService } from '@/lib/crm/ticket-service';
import { ticketAIService } from '@/lib/ai/ticket-ai-service';
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

        const ticket = await ticketService.getTicketDetails(id);
        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        const summary = await ticketAIService.summarizeTicket({
            subject: ticket.subject,
            description: ticket.description,
            activities: ticket.activities.map(a => ({
                eventType: a.eventType,
                description: a.description,
                createdAt: a.createdAt,
            })),
        });

        return NextResponse.json(summary);
    } catch (error) {
        if (!isApiException(error)) {
            console.error('Error generating AI summary:', error);
        }
        return handleApiError(error);
    }
}
