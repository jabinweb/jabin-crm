import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { resolvePortalDataAccess } from '@/lib/api/portal-access';
import { workspaceStaffWhere } from '@/lib/auth/workspace-staff';

export type PortalCustomerScope =
  | { ok: false; status: number; error: string }
  | { ok: true; customerId: string; email: string | null; companyId: string | null };

/** Resolve CUSTOMER session → customer id + email for billing/doc scoping. */
export async function resolvePortalCustomerScope(
  session: Session | null
): Promise<PortalCustomerScope> {
  const access = resolvePortalDataAccess(session);
  if (!access.ok) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  if (access.scope === 'staff') {
    return { ok: false, status: 403, error: 'Staff preview has no customer billing scope' };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: access.customerId },
    select: { id: true, email: true, companyId: true },
  });
  if (!customer) {
    return { ok: false, status: 404, error: 'Customer not found' };
  }

  return {
    ok: true,
    customerId: customer.id,
    email: customer.email,
    companyId: customer.companyId,
  };
}

/**
 * Prisma where for invoices/quotations belonging to this portal customer.
 *
 * Email matches only count for documents created by staff of the customer's own
 * workspace — the same address can be a customer of several tenants.
 */
export function portalBillingWhere(scope: {
  customerId: string;
  email: string | null;
  companyId: string | null;
}) {
  const emailClause =
    scope.email && scope.email.trim() && scope.companyId
      ? [
          {
            customerEmail: { equals: scope.email.trim(), mode: 'insensitive' as const },
            user: workspaceStaffWhere(scope.companyId),
          },
        ]
      : [];

  return {
    OR: [{ customerId: scope.customerId }, ...emailClause],
    status: { not: 'DRAFT' as const },
  };
}

/**
 * Link billing docs to a Customer of the document's workspace (the request workspace
 * when known, else the creator's home company). A client-supplied `customerId` is only
 * honoured when it belongs to that workspace; otherwise it falls back to email matching.
 */
export async function resolveBillingCustomerId(params: {
  customerId?: string | null;
  customerEmail: string;
  userId: string;
  companyId?: string | null;
}): Promise<string | undefined> {
  let companyId = params.companyId || null;
  if (!companyId) {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { primaryCompanyId: true, companyId: true },
    });
    companyId = user?.primaryCompanyId || user?.companyId || null;
  }
  if (!companyId) return undefined;

  if (params.customerId) {
    const owned = await prisma.customer.findFirst({
      where: { id: params.customerId, companyId },
      select: { id: true },
    });
    if (owned) return owned.id;
  }

  const email = params.customerEmail?.trim();
  if (!email) return undefined;

  const customer = await prisma.customer.findFirst({
    where: {
      companyId,
      email: { equals: email, mode: 'insensitive' },
    },
    select: { id: true },
  });
  return customer?.id;
}
