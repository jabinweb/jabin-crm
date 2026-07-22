import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { validateRequest } from '@/lib/validations/server';
import { updateServiceContract } from '@/lib/crm/service-contract-service';
import { prisma } from '@/lib/prisma';

const patchSchema = z.object({
  title: z.string().min(2).optional(),
  type: z.enum(['AMC', 'CMC']).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED']).optional(),
  contractNumber: z.string().optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reminderDays: z.number().int().min(1).max(365).optional(),
  annualValue: z.number().nonnegative().optional().nullable(),
  currency: z.string().optional(),
  includesParts: z.boolean().optional(),
  visitLimit: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  equipmentId: z.string().optional().nullable(),
});

export const GET = withTenantRoute(async (_req, { companyId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const contract = await prisma.serviceContract.findFirst({
    where: { id, companyId },
    include: {
      customer: { select: { id: true, organizationName: true, city: true } },
      equipment: {
        select: {
          id: true,
          serialNumber: true,
          product: { select: { name: true, modelNumber: true } },
        },
      },
    },
  });
  if (!contract) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return jsonOk(contract);
});

export const PATCH = withTenantRoute(async (req, { companyId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const body = await validateRequest(req, patchSchema);

  try {
    const contract = await updateServiceContract(companyId, id, {
      ...body,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    });
    return jsonOk(contract);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update' },
      { status: 400 }
    );
  }
});
