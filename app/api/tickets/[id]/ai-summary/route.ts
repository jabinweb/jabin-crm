import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ticketService } from '@/lib/crm/ticket-service';
import { ticketAIService } from '@/lib/ai/ticket-ai-service';

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

        // Fetch full ticket details including description and activities
        const ticket = await ticketService.getTicketDetails(id);
        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        // Generate summary using Gemini
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
        console.error('Error generating AI summary:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
