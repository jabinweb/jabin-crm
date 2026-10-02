import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { validateRequest } from '@/lib/validations/server';
import { expenseService } from '@/lib/crm/expense-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { workspaceStaffWhere } from '@/lib/auth/workspace-staff';

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED']),
  rejectionReason: z.string().optional(),
});

export const PATCH = withTenantRoute(async (req, { session, userId, companyId }, routeContext) => {
  // Approving, rejecting and reimbursing are manager actions.
  if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureFeatureEnabled(userId, 'SERVICE_EXPENSES', companyId);
  const { id } = await routeContext.params;
  const body = await validateRequest(req, updateStatusSchema);

  // Expense must belong to a technician in this workspace.
  const existing = await prisma.travelExpense.findFirst({
    where: { id, technician: workspaceStaffWhere(companyId) },
    select: { id: true, technicianId: true, userId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }
  // Nobody signs off their own expense.
  if (body.status !== 'PENDING' && (existing.technicianId === userId || existing.userId === userId)) {
    return NextResponse.json({ error: 'You cannot approve your own expense' }, { status: 403 });
  }

  const expense = await expenseService.updateExpenseStatus(
    id,
    body.status,
    userId,
    body.rejectionReason
  );

  return jsonOk(expense);
});
