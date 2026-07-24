import { prisma } from '@/lib/prisma';
import {
  companyDefaultCurrencyFromSettings,
  resolveCurrency,
  type ResolveDocumentCurrencyInput,
  type CurrencyCode,
} from '@/lib/currency/resolve';

/**
 * DB-backed resolver for create paths. Stamps the result onto the document.
 * Server-only — do not import from client components.
 */
export async function resolveDocumentCurrency(
  params: ResolveDocumentCurrencyInput
): Promise<CurrencyCode> {
  let customerBilling: string | null = null;
  let companyId = params.companyId ?? null;
  let userPreferred: string | null = null;

  if (params.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: params.customerId },
      select: { billingCurrency: true, companyId: true },
    });
    if (customer) {
      customerBilling = customer.billingCurrency;
      if (!companyId) companyId = customer.companyId;
    }
  } else if (params.customerEmail?.trim() && companyId) {
    const customer = await prisma.customer.findFirst({
      where: {
        companyId,
        email: { equals: params.customerEmail.trim(), mode: 'insensitive' },
      },
      select: { billingCurrency: true },
    });
    customerBilling = customer?.billingCurrency ?? null;
  }

  if (!companyId && params.userId) {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        primaryCompanyId: true,
        companyId: true,
        profile: { select: { preferredCurrency: true } },
      },
    });
    companyId = user?.primaryCompanyId || user?.companyId || null;
    userPreferred = user?.profile?.preferredCurrency ?? null;
  } else if (params.userId) {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: params.userId },
      select: { preferredCurrency: true },
    });
    userPreferred = profile?.preferredCurrency ?? null;
  }

  let companyDefault: string | null = null;
  if (companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true },
    });
    companyDefault = companyDefaultCurrencyFromSettings(company?.settings);
  }

  if (!customerBilling && params.customerEmail?.trim() && companyId && !params.customerId) {
    const customer = await prisma.customer.findFirst({
      where: {
        companyId,
        email: { equals: params.customerEmail.trim(), mode: 'insensitive' },
      },
      select: { billingCurrency: true },
    });
    customerBilling = customer?.billingCurrency ?? null;
  }

  return resolveCurrency({
    explicit: params.explicit,
    customerBillingCurrency: customerBilling,
    companyDefaultCurrency: companyDefault,
    userPreferredCurrency: userPreferred,
  });
}
