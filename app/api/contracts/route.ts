import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { validateRequest } from '@/lib/validations/server';
import {
  createServiceContract,
  expireOverdueContracts,
  listRenewalAlerts,
  listServiceContracts,
} from '@/lib/crm/service-contract-service';

const createSchema = z.object({
  customerId: z.string().min(1),
  equipmentId: z.string().optional().nullable(),
  type: z.enum(['AMC', 'CMC']),
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED']).optional(),
  contractNumber: z.string().optional().nullable(),
  title: z.string().min(2),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reminderDays: z.number().int().min(1).max(365).optional(),
  annualValue: z.number().nonnegative().optional().nullable(),
  currency: z.string().optional(),
  includesParts: z.boolean().optional(),
  visitLimit: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const GET = withTenantRoute(async (req, { companyId }) => {
  await expireOverdueContracts(companyId);

  const renewals = req.nextUrl.searchParams.get('renewals');
  if (renewals === '1' || renewals === 'true') {
    const within = parseInt(req.nextUrl.searchParams.get('withinDays') || '60', 10);
    const alerts = await listRenewalAlerts(
      companyId,
      Number.isFinite(within) ? within : 60
    );
    return jsonOk({ renewals: alerts, count: alerts.length });
  }

  const status = req.nextUrl.searchParams.get('status') as
    | 'DRAFT'
    | 'ACTIVE'
    | 'EXPIRED'
    | 'CANCELLED'
    | null;
  const type = req.nextUrl.searchParams.get('type') as 'AMC' | 'CMC' | null;

  const contracts = await listServiceContracts(companyId, {
    status: status || undefined,
    type: type || undefined,
  });

  return jsonOk({ contracts });
});

export const POST = withTenantRoute(async (req, { companyId }) => {
  const body = await validateRequest(req, createSchema);

  try {
    const contract = await createServiceContract({
      companyId,
      customerId: body.customerId,
      equipmentId: body.equipmentId,
      type: body.type,
      status: body.status,
      contractNumber: body.contractNumber,
      title: body.title,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      reminderDays: body.reminderDays,
      annualValue: body.annualValue,
      currency: body.currency,
      includesParts: body.includesParts,
      visitLimit: body.visitLimit,
      notes: body.notes,
    });
    return jsonOk(contract, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create contract' },
      { status: 400 }
    );
  }
});
