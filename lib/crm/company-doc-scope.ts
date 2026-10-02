/**
 * Prisma where-clause for listing user-owned CRM docs company-wide for admins.
 * Models without companyId: Quotation, Invoice (and similar) are scoped via lead or owner membership.
 */
export function companyOwnedDocWhere(companyId: string) {
  return {
    OR: [
      { lead: { companyId } },
      { user: { primaryCompanyId: companyId } },
      { user: { userCompanies: { some: { companyId } } } },
    ],
  };
}

export function isCompanyAdminRole(role?: string | null) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

/**
 * Where-clause for a single Invoice/Quotation the caller may act on: their own docs, or
 * (company admins) any doc owned within the request workspace. Mirrors the list routes.
 */
export async function accessibleDocWhere(
  session: { user: { id: string; role?: string | null } },
  req: import('next/server').NextRequest
): Promise<Record<string, unknown>> {
  const userId = session.user.id;
  if (isCompanyAdminRole(session.user.role)) {
    try {
      const { resolveCompanyContextFromRequest } = await import('@/lib/auth/company-membership');
      const ctx = await resolveCompanyContextFromRequest(
        session as unknown as import('next-auth').Session,
        req
      );
      return { OR: [{ userId }, ...companyOwnedDocWhere(ctx.companyId).OR] };
    } catch {
      /* fall back to own docs */
    }
  }
  return { userId };
}
