import { prisma } from '@/lib/prisma';
import type { ServiceContractStatus, ServiceContractType } from '@prisma/client';
import { daysUntil, renewalUrgency } from '@/lib/crm/service-contract-utils';
import { attachVisitUsage } from '@/lib/crm/field-ops';

export type CreateServiceContractInput = {
  companyId: string;
  customerId: string;
  equipmentId?: string | null;
  type: ServiceContractType;
  status?: ServiceContractStatus;
  contractNumber?: string | null;
  title: string;
  startDate: Date;
  endDate: Date;
  reminderDays?: number;
  annualValue?: number | null;
  currency?: string;
  includesParts?: boolean;
  visitLimit?: number | null;
  notes?: string | null;
};

const contractInclude = {
  customer: { select: { id: true, organizationName: true, city: true } },
  equipment: {
    select: {
      id: true,
      serialNumber: true,
      product: { select: { name: true, modelNumber: true } },
    },
  },
} as const;

export { daysUntil, renewalUrgency } from '@/lib/crm/service-contract-utils';

export async function listServiceContracts(
  companyId: string,
  opts?: { status?: ServiceContractStatus; type?: ServiceContractType }
) {
  const contracts = await prisma.serviceContract.findMany({
    where: {
      companyId,
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.type ? { type: opts.type } : {}),
    },
    include: contractInclude,
    orderBy: { endDate: 'asc' },
  });
  type Row = (typeof contracts)[number];
  return attachVisitUsage<Row>(contracts);
}

/** Active contracts ending within `withinDays`, plus already overdue active ones. */
export async function listRenewalAlerts(companyId: string, withinDays = 60) {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + withinDays);

  const contracts = await prisma.serviceContract.findMany({
    where: {
      companyId,
      status: 'ACTIVE',
      endDate: { lte: horizon },
    },
    include: contractInclude,
    orderBy: { endDate: 'asc' },
    take: 50,
  });

  type Row = (typeof contracts)[number];
  const withUsage = await attachVisitUsage<Row>(contracts);

  return withUsage.map((c) => {
    const daysLeft = daysUntil(c.endDate, now);
    return {
      ...c,
      daysLeft,
      urgency: renewalUrgency(daysLeft),
    };
  });
}

export async function getServiceContract(companyId: string, id: string) {
  const contract = await prisma.serviceContract.findFirst({
    where: { id, companyId },
    include: contractInclude,
  });
  if (!contract) return null;
  type Row = typeof contract;
  const [withUsage] = await attachVisitUsage<Row>([contract]);
  return withUsage;
}

/** Suggest ACTIVE contracts for a customer (optionally matching equipment). */
export async function suggestContractsForTicket(
  companyId: string,
  customerId: string,
  equipmentId?: string | null
) {
  const contracts = await prisma.serviceContract.findMany({
    where: {
      companyId,
      customerId,
      status: 'ACTIVE',
      ...(equipmentId
        ? { OR: [{ equipmentId }, { equipmentId: null }] }
        : {}),
    },
    include: contractInclude,
    orderBy: { endDate: 'asc' },
  });
  type Row = (typeof contracts)[number];
  return attachVisitUsage<Row>(contracts);
}

export async function createServiceContract(input: CreateServiceContractInput) {
  if (input.endDate <= input.startDate) {
    throw new Error('End date must be after start date');
  }

  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, companyId: input.companyId },
    select: { id: true },
  });
  if (!customer) throw new Error('Customer not found in this workspace');

  if (input.equipmentId) {
    const equipment = await prisma.equipmentInstallation.findFirst({
      where: {
        id: input.equipmentId,
        customerId: input.customerId,
      },
      select: { id: true },
    });
    if (!equipment) throw new Error('Equipment does not belong to this customer');
  }

  const includesParts =
    input.includesParts ?? input.type === 'CMC';

  const { resolveDocumentCurrency } = await import('@/lib/currency/resolve-document');
  const currency = await resolveDocumentCurrency({
    explicit: input.currency,
    customerId: input.customerId,
    companyId: input.companyId,
  });

  const created = await prisma.serviceContract.create({
    data: {
      companyId: input.companyId,
      customerId: input.customerId,
      equipmentId: input.equipmentId || null,
      type: input.type,
      status: input.status ?? 'ACTIVE',
      contractNumber: input.contractNumber?.trim() || null,
      title: input.title.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      reminderDays: input.reminderDays ?? 45,
      annualValue: input.annualValue ?? null,
      currency,
      includesParts,
      visitLimit: input.visitLimit ?? null,
      notes: input.notes?.trim() || null,
    },
    include: contractInclude,
  });
  type Row = typeof created;
  const [withUsage] = await attachVisitUsage<Row>([created]);
  return withUsage;
}

export async function updateServiceContract(
  companyId: string,
  id: string,
  data: Partial<CreateServiceContractInput> & { status?: ServiceContractStatus }
) {
  const existing = await prisma.serviceContract.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!existing) throw new Error('Contract not found');

  const updated = await prisma.serviceContract.update({
    where: { id },
    data: {
      ...(data.title != null ? { title: data.title.trim() } : {}),
      ...(data.type != null ? { type: data.type } : {}),
      ...(data.status != null ? { status: data.status } : {}),
      ...(data.contractNumber !== undefined
        ? { contractNumber: data.contractNumber?.trim() || null }
        : {}),
      ...(data.startDate != null ? { startDate: data.startDate } : {}),
      ...(data.endDate != null ? { endDate: data.endDate } : {}),
      ...(data.reminderDays != null ? { reminderDays: data.reminderDays } : {}),
      ...(data.annualValue !== undefined ? { annualValue: data.annualValue } : {}),
      ...(data.currency != null ? { currency: data.currency } : {}),
      ...(data.includesParts != null ? { includesParts: data.includesParts } : {}),
      ...(data.visitLimit !== undefined ? { visitLimit: data.visitLimit } : {}),
      ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
      ...(data.equipmentId !== undefined
        ? { equipmentId: data.equipmentId || null }
        : {}),
    },
    include: contractInclude,
  });
  type Row = typeof updated;
  const [withUsage] = await attachVisitUsage<Row>([updated]);
  return withUsage;
}

/** Mark ACTIVE contracts past endDate as EXPIRED. */
export async function expireOverdueContracts(companyId: string) {
  const result = await prisma.serviceContract.updateMany({
    where: {
      companyId,
      status: 'ACTIVE',
      endDate: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });
  return result.count;
}
