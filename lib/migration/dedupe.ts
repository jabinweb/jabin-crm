import { prisma } from '@/lib/prisma';

export async function loadExistingLeadEmails(
  companyId: string,
  emails: string[]
): Promise<Set<string>> {
  if (!emails.length) return new Set();
  const existing = await prisma.lead.findMany({
    where: {
      companyId,
      email: { in: emails },
    },
    select: { email: true },
  });
  return new Set(
    existing
      .map((l) => l.email?.toLowerCase().trim())
      .filter((e): e is string => !!e)
  );
}

export async function loadExistingCustomerEmails(
  companyId: string,
  emails: string[]
): Promise<Set<string>> {
  if (!emails.length) return new Set();
  const existing = await prisma.customer.findMany({
    where: {
      companyId,
      email: { in: emails },
    },
    select: { email: true },
  });
  return new Set(
    existing
      .map((c) => c.email?.toLowerCase().trim())
      .filter((e): e is string => !!e)
  );
}

export async function findCustomerIdByEmail(
  companyId: string,
  email: string
): Promise<string | null> {
  const customer = await prisma.customer.findFirst({
    where: {
      companyId,
      OR: [
        { email: { equals: email, mode: 'insensitive' } },
        { contacts: { some: { email: { equals: email, mode: 'insensitive' } } } },
      ],
    },
    select: { id: true },
  });
  return customer?.id ?? null;
}

export function customerOrgKey(organizationName: string, contactPerson: string): string {
  return `${organizationName.trim().toLowerCase()}::${contactPerson.trim().toLowerCase()}`;
}

export async function loadExistingCustomerOrgKeys(
  companyId: string
): Promise<Set<string>> {
  const existing = await prisma.customer.findMany({
    where: { companyId },
    select: { organizationName: true, contactPerson: true },
  });
  return new Set(
    existing.map((c) => customerOrgKey(c.organizationName, c.contactPerson))
  );
}
