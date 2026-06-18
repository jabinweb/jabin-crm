import type { Session } from 'next-auth';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';

/**
 * Resolve tenant companyId for staff API routes.
 * SUPER_ADMIN may omit tenant context only when explicitly allowed.
 */
export async function resolveStaffCompanyScope(
  session: Session,
  req: NextRequest,
  options?: { allowGlobalForSuperAdmin?: boolean }
): Promise<string | null> {
  const role = session.user?.role;
  if (role === 'SUPER_ADMIN' && options?.allowGlobalForSuperAdmin) {
    try {
      const { companyId } = await resolveCompanyContextFromRequest(session, req);
      return companyId;
    } catch (e) {
      if (e instanceof TenantError && e.status === 400) return null;
      throw e;
    }
  }

  const { companyId } = await resolveCompanyContextFromRequest(session, req);
  return companyId;
}

/** Require company context for staff. */
export async function requireStaffCompanyScope(
  session: Session,
  req: NextRequest,
  options?: { allowGlobalForSuperAdmin?: boolean }
): Promise<string> {
  const companyId = await resolveStaffCompanyScope(session, req, options);
  if (companyId) return companyId;
  throw new TenantError(400, 'Company context required');
}

/** Staff company scope; undefined only for SUPER_ADMIN without URL/JWT context. */
export async function resolveOptionalStaffCompanyScope(
  session: Session,
  req: NextRequest
): Promise<string | undefined> {
  try {
    return await requireStaffCompanyScope(session, req, { allowGlobalForSuperAdmin: true });
  } catch (e) {
    if (e instanceof TenantError && session.user?.role === 'SUPER_ADMIN') {
      return undefined;
    }
    throw e;
  }
}

export function customerBelongsToCompanyFilter(companyId: string) {
  return { customer: { companyId } };
}

type TicketTenantRow = {
  id: string;
  customerId: string;
  customer: { companyId: string | null } | null;
};

/** Returns null when ticket missing or caller lacks tenant access (use 404). */
export async function assertTicketTenantAccess(
  session: Session,
  req: NextRequest,
  ticketId: string
): Promise<TicketTenantRow | null> {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      customerId: true,
      customer: { select: { companyId: true } },
    },
  });
  if (!ticket) return null;

  if (session.user?.role === 'CUSTOMER') {
    return ticket.customerId === session.user.customerId ? ticket : null;
  }

  const companyId = await resolveStaffCompanyScope(session, req, {
    allowGlobalForSuperAdmin: true,
  });
  if (!companyId) {
    if (session.user?.role === 'SUPER_ADMIN') return ticket;
    throw new TenantError(400, 'Company context required');
  }

  return ticket.customer?.companyId === companyId ? ticket : null;
}

/** Returns null when customer missing or caller lacks tenant access (use 404). */
export async function assertCustomerTenantAccess(
  session: Session,
  req: NextRequest,
  customerId: string
): Promise<{ id: string; companyId: string | null } | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, companyId: true },
  });
  if (!customer) return null;

  if (session.user?.role === 'CUSTOMER') {
    return customer.id === session.user.customerId ? customer : null;
  }

  const companyId = await resolveStaffCompanyScope(session, req, {
    allowGlobalForSuperAdmin: true,
  });
  if (!companyId) {
    if (session.user?.role === 'SUPER_ADMIN') return customer;
    throw new TenantError(400, 'Company context required');
  }

  return customer.companyId === companyId ? customer : null;
}
