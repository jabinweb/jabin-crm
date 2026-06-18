import { z } from 'zod';
import { validateRequest } from '@/lib/validations/server';
import { cashService } from '@/lib/crm/cash-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

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

export const POST = withSessionRoute(async (req, { userId }) => {
  await ensureFeatureEnabled(userId, 'SERVICE_CASH');
  const body = await validateRequest(req, createCashSchema);

  const entry = await cashService.createEntry(userId, {
    ...body,
    recordedAt: body.recordedAt ? new Date(body.recordedAt) : undefined,
  });

  return jsonOk(entry, { status: 201 });
});

export const GET = withSessionRoute(async (req, { userId }) => {
  await ensureFeatureEnabled(userId, 'SERVICE_CASH');
  const { searchParams } = req.nextUrl;

  const entries = await cashService.listEntries(userId, {
    technicianId: searchParams.get('technicianId') || undefined,
    ticketId: searchParams.get('ticketId') || undefined,
    entryType: (searchParams.get('entryType') as 'ADVANCE' | 'EXPENSE' | 'SETTLEMENT' | 'ADJUSTMENT') || undefined,
    startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
    endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
  });

  return jsonOk(entries);
});
