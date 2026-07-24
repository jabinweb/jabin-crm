import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { resolvePortalDataAccess } from '@/lib/api/portal-access';

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

/** Prisma where for invoices/quotations belonging to this portal customer. */
export function portalBillingWhere(scope: {
  customerId: string;
  email: string | null;
}) {
  const emailClause =
    scope.email && scope.email.trim()
      ? [{ customerEmail: { equals: scope.email.trim(), mode: 'insensitive' as const } }]
      : [];

  return {
    OR: [{ customerId: scope.customerId }, ...emailClause],
    status: { not: 'DRAFT' as const },
  };
}

/**
 * Link billing docs to Customer by email within the creator's company when possible.
 */
export async function resolveBillingCustomerId(params: {
  customerId?: string | null;
  customerEmail: string;
  userId: string;
}): Promise<string | undefined> {
  if (params.customerId) return params.customerId;

  const email = params.customerEmail?.trim();
  if (!email) return undefined;

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { primaryCompanyId: true, companyId: true },
  });
  const companyId = user?.primaryCompanyId || user?.companyId;
  if (!companyId) return undefined;

  const customer = await prisma.customer.findFirst({
    where: {
      companyId,
      email: { equals: email, mode: 'insensitive' },
    },
    select: { id: true },
  });
  return customer?.id;
}
