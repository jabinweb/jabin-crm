import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { handleApiError } from '@/lib/api-error-handler';
import { whatsAppService } from '@/lib/crm/whatsapp-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await ensureFeatureEnabled(session.user.id, 'WHATSAPP');
    const { searchParams } = req.nextUrl;

    const messages = await whatsAppService.listMessages(session.user.id, {
      channel: (searchParams.get('channel') as any) || undefined,
      leadId: searchParams.get('leadId') || undefined,
      customerId: searchParams.get('customerId') || undefined,
      ticketId: searchParams.get('ticketId') || undefined,
    });

    return NextResponse.json(messages);
  } catch (error) {
    return handleApiError(error);
  }
}
