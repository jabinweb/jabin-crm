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

export async function findLeadIdByEmail(
  companyId: string,
  email: string
): Promise<string | null> {
  const lead = await prisma.lead.findFirst({
    where: {
      companyId,
      email: { equals: email, mode: 'insensitive' },
    },
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
  });
  return lead?.id ?? null;
}

export async function findProductIdByNameOrSku(
  companyId: string,
  nameOrSku: string
): Promise<string | null> {
  const q = nameOrSku.trim();
  if (!q) return null;
  const product = await prisma.product.findFirst({
    where: {
      companyId,
      OR: [
        { name: { equals: q, mode: 'insensitive' } },
        { sku: { equals: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  return product?.id ?? null;
}

export async function findLocationIdByName(
  companyId: string,
  name: string
): Promise<string | null> {
  const location = await prisma.location.findFirst({
    where: {
      companyId,
      name: { equals: name.trim(), mode: 'insensitive' },
    },
    select: { id: true },
  });
  return location?.id ?? null;
}

export async function findOrCreateDepartmentId(
  customerId: string,
  name: string
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = await prisma.customerDepartment.findFirst({
    where: { customerId, name: { equals: trimmed, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.customerDepartment.create({
    data: { customerId, name: trimmed },
    select: { id: true },
  });
  return created.id;
}

export function parseBool(raw?: string): boolean {
  if (!raw) return false;
  return ['1', 'true', 'yes', 'y'].includes(raw.trim().toLowerCase());
}

export function parseDate(raw?: string): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw.trim().replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}
