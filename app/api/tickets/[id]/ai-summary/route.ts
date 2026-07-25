import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { ticketService } from '@/lib/crm/ticket-service';
import { ticketAIService } from '@/lib/ai/ticket-ai-service';
import { handleApiError, ApiErrors } from '@/lib/api-error-handler';
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

    const profile = await prisma.userProfile.findUnique({
      where: { userId: guard.session.user.id },
      select: { geminiApiKey: true, aiModel: true },
    });

    let userApiKey: string | undefined;
    if (profile?.geminiApiKey) {
      try {
        userApiKey = decrypt(profile.geminiApiKey).trim();
      } catch {
        /* fall through to env key */
      }
    }

    const hasKey = !!(userApiKey || process.env.GEMINI_API_KEY?.trim());
    if (!hasKey) {
      throw ApiErrors.badRequest(
        'No Gemini API key configured. Add one in Settings → AI, or set GEMINI_API_KEY.'
      );
    }

    const ticket = await ticketService.getTicketDetails(id);
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Keep the prompt small — WhatsApp-linked tickets can have huge histories
    const recentActivities = (ticket.activities || []).slice(0, 40);

    const summary = await ticketAIService.summarizeTicket({
      subject: ticket.subject,
      description: ticket.description,
      activities: recentActivities.map((a) => ({
        eventType: a.eventType,
        description: String(a.description || '').slice(0, 500),
        createdAt: a.createdAt,
      })),
      apiKey: userApiKey,
      model: profile?.aiModel || 'gemini-2.5-flash',
    });

    return NextResponse.json(summary);
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error generating AI summary:', error);
    }
    return handleApiError(error);
  }
}
