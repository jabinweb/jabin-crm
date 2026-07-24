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
