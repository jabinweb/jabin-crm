import { NextResponse } from 'next/server';
import { checkOpsAccess, SALES_DOC_ROLES } from '@/lib/crm/ops-access';
import { z } from 'zod';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { validateRequest } from '@/lib/validations/server';
import { getServiceContract, updateServiceContract } from '@/lib/crm/service-contract-service';

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

export const GET = withTenantRoute(async (_req, { session, companyId }, routeContext) => {
  // Contracts live under Support in the nav: sales and support roles, Tickets module
  const denied = await checkOpsAccess(session, companyId, { roles: SALES_DOC_ROLES, module: 'TICKETS' });
  if (denied) return denied;
  const id = (await routeContext!.params).id;
  const contract = await getServiceContract(companyId, id);
  if (!contract) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return jsonOk(contract);
});

export const PATCH = withTenantRoute(async (req, { session, companyId }, routeContext) => {
  // Contracts live under Support in the nav: sales and support roles, Tickets module, and the warranties feature for changes
  const denied = await checkOpsAccess(session, companyId, { roles: SALES_DOC_ROLES, module: 'TICKETS', feature: 'warranties' });
  if (denied) return denied;
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
