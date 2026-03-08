import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-middleware';
import { validateRequest } from '@/lib/validation';
import { handleApiError } from '@/lib/api-error-handler';
import { cashService } from '@/lib/crm/cash-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';

const createCashSchema = z.object({
  technicianId: z.string().min(1),
  ticketId: z.string().optional(),
  entryType: z.enum(['ADVANCE', 'EXPENSE', 'SETTLEMENT', 'ADJUSTMENT']),
  amount: z.number().positive(),
  currency: z.string().optional(),
  description: z.string().min(1),
  referenceNo: z.string().optional(),
  recordedAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await ensureFeatureEnabled(session.user.id, 'SERVICE_CASH');
    const body = await validateRequest(req, createCashSchema);

    const entry = await cashService.createEntry(session.user.id, {
      ...body,
      recordedAt: body.recordedAt ? new Date(body.recordedAt) : undefined,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await ensureFeatureEnabled(session.user.id, 'SERVICE_CASH');
    const { searchParams } = req.nextUrl;

    const entries = await cashService.listEntries(session.user.id, {
      technicianId: searchParams.get('technicianId') || undefined,
      ticketId: searchParams.get('ticketId') || undefined,
      entryType: (searchParams.get('entryType') as any) || undefined,
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
    });

    return NextResponse.json(entries);
  } catch (error) {
    return handleApiError(error);
  }
}
