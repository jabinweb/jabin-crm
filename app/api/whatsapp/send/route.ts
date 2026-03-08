import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-middleware';
import { validateRequest } from '@/lib/validation';
import { handleApiError } from '@/lib/api-error-handler';
import { whatsAppService } from '@/lib/crm/whatsapp-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';

const sendWhatsAppSchema = z.object({
  toPhone: z.string().min(6),
  message: z.string().min(1),
  channel: z.enum(['SALES', 'SERVICE']),
  leadId: z.string().optional(),
  customerId: z.string().optional(),
  ticketId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await ensureFeatureEnabled(session.user.id, 'WHATSAPP');
    const body = await validateRequest(req, sendWhatsAppSchema);

    const message = await whatsAppService.sendMessage({
      userId: session.user.id,
      ...body,
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
