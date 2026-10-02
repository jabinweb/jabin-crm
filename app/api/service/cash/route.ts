import { z } from 'zod';
import { validateRequest } from '@/lib/validations/server';
import { cashService } from '@/lib/crm/cash-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withSessionRoute, withTenantRoute, jsonOk, withApiRoute } from '@/lib/api/with-route';
import { isWorkspaceStaff } from '@/lib/auth/workspace-staff';
import { isFieldServiceManager, isFieldServiceUser } from '@/app/api/service/_roles';

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

export const POST = withTenantRoute(async (req, { session, userId, companyId }) => {
  if (!isFieldServiceUser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureFeatureEnabled(userId, 'SERVICE_CASH', companyId);
  const body = await validateRequest(req, createCashSchema);

  // Advances, settlements and adjustments are manager entries; technicians only log
  // their own spending.
  if (!isFieldServiceManager(session) && (body.entryType !== 'EXPENSE' || body.technicianId !== userId)) {
    return NextResponse.json({ error: 'Only managers can record that entry' }, { status: 403 });
  }

  if (!(await isWorkspaceStaff(companyId, body.technicianId))) {
    return NextResponse.json({ error: 'Technician not found' }, { status: 404 });
  }
  if (body.ticketId) {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: body.ticketId, customer: { companyId } },
      select: { id: true },
    });
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
  }

  const entry = await cashService.createEntry(userId, {
    ...body,
    recordedAt: body.recordedAt ? new Date(body.recordedAt) : undefined,
  });

  return jsonOk(entry, { status: 201 });
});

export const GET = withApiRoute({ auth: 'tenant-optional', handler: async (req, { session, userId, companyId }) => {
  if (!isFieldServiceUser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureFeatureEnabled(userId, 'SERVICE_CASH', companyId);
  const { searchParams } = req.nextUrl;

  const entries = await cashService.listEntries(userId, {
    companyId,
    viewAll: isFieldServiceManager(session),
    technicianId: searchParams.get('technicianId') || undefined,
    ticketId: searchParams.get('ticketId') || undefined,
    entryType: (searchParams.get('entryType') as 'ADVANCE' | 'EXPENSE' | 'SETTLEMENT' | 'ADJUSTMENT') || undefined,
    startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
    endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
  });

  return jsonOk(entries);
} });
