import { prisma } from '@/lib/prisma';
import type { DemoMovementType, DemoUnitKind, DemoUnitStatus } from '@prisma/client';

const unitInclude = {
  product: { select: { id: true, name: true, sku: true } },
  currentLocation: { select: { id: true, name: true, code: true } },
  currentCustomer: { select: { id: true, organizationName: true } },
  custodian: { select: { id: true, name: true, email: true } },
} as const;

export type CreateDemoUnitInput = {
  name: string;
  kind?: DemoUnitKind;
  productId?: string | null;
  serialNumber?: string | null;
  assetTag?: string | null;
  status?: DemoUnitStatus;
  currentLocationId?: string | null;
  currentCustomerId?: string | null;
  custodianUserId?: string | null;
  notes?: string | null;
  expectedReturnAt?: string | Date | null;
};

export type MoveDemoUnitInput = {
  type: DemoMovementType;
  toLocationId?: string | null;
  toCustomerId?: string | null;
  toCustodianId?: string | null;
  purpose?: string | null;
  notes?: string | null;
  expectedReturnAt?: string | Date | null;
  /** Override status after move; otherwise inferred from type */
  status?: DemoUnitStatus;
};

function statusForMove(type: DemoMovementType, hasCustomer: boolean): DemoUnitStatus {
  switch (type) {
    case 'CHECKOUT':
      return hasCustomer ? 'ON_DEMO' : 'IN_TRANSIT';
    case 'TRANSFER':
      return hasCustomer ? 'AT_CUSTOMER' : 'IN_TRANSIT';
    case 'RETURN':
      return 'IN_STOCK';
    case 'RELOCATE':
      return hasCustomer ? 'AT_CUSTOMER' : 'IN_STOCK';
    case 'MAINTENANCE':
      return 'MAINTENANCE';
    case 'RETIRE':
      return 'RETIRED';
    default:
      return 'IN_STOCK';
  }
}

export async function listDemoUnits(
  companyId: string,
  opts?: { status?: DemoUnitStatus; kind?: DemoUnitKind; q?: string }
) {
  const q = opts?.q?.trim();
  return prisma.demoEquipmentUnit.findMany({
    where: {
      companyId,
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.kind ? { kind: opts.kind } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { serialNumber: { contains: q, mode: 'insensitive' } },
              { assetTag: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: unitInclude,
    orderBy: [{ updatedAt: 'desc' }],
    take: 200,
  });
}

export async function getDemoUnit(companyId: string, id: string) {
  return prisma.demoEquipmentUnit.findFirst({
    where: { id, companyId },
    include: {
      ...unitInclude,
      movements: {
        orderBy: { movedAt: 'desc' },
        take: 50,
        include: {
          fromLocation: { select: { id: true, name: true } },
          toLocation: { select: { id: true, name: true } },
          fromCustomer: { select: { id: true, organizationName: true } },
          toCustomer: { select: { id: true, organizationName: true } },
          toCustodian: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function createDemoUnit(
  companyId: string,
  data: CreateDemoUnitInput
) {
  return prisma.demoEquipmentUnit.create({
    data: {
      companyId,
      name: data.name.trim(),
      kind: data.kind || 'DEMO_MACHINE',
      productId: data.productId || null,
      serialNumber: data.serialNumber?.trim() || null,
      assetTag: data.assetTag?.trim() || null,
      status: data.status || 'IN_STOCK',
      currentLocationId: data.currentLocationId || null,
      currentCustomerId: data.currentCustomerId || null,
      custodianUserId: data.custodianUserId || null,
      notes: data.notes?.trim() || null,
      expectedReturnAt: data.expectedReturnAt
        ? new Date(data.expectedReturnAt)
        : null,
    },
    include: unitInclude,
  });
}

export async function updateDemoUnit(
  companyId: string,
  id: string,
  data: Partial<CreateDemoUnitInput>
) {
  const existing = await prisma.demoEquipmentUnit.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.demoEquipmentUnit.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.kind !== undefined ? { kind: data.kind } : {}),
      ...(data.productId !== undefined ? { productId: data.productId || null } : {}),
      ...(data.serialNumber !== undefined
        ? { serialNumber: data.serialNumber?.trim() || null }
        : {}),
      ...(data.assetTag !== undefined ? { assetTag: data.assetTag?.trim() || null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.currentLocationId !== undefined
        ? { currentLocationId: data.currentLocationId || null }
        : {}),
      ...(data.currentCustomerId !== undefined
        ? { currentCustomerId: data.currentCustomerId || null }
        : {}),
      ...(data.custodianUserId !== undefined
        ? { custodianUserId: data.custodianUserId || null }
        : {}),
      ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
      ...(data.expectedReturnAt !== undefined
        ? {
            expectedReturnAt: data.expectedReturnAt
              ? new Date(data.expectedReturnAt)
              : null,
          }
        : {}),
    },
    include: unitInclude,
  });
}

export async function moveDemoUnit(
  companyId: string,
  unitId: string,
  input: MoveDemoUnitInput,
  createdById?: string
) {
  const unit = await prisma.demoEquipmentUnit.findFirst({
    where: { id: unitId, companyId },
  });
  if (!unit) return null;

  const toCustomerId =
    input.type === 'RETURN' ? null : input.toCustomerId !== undefined
      ? input.toCustomerId
      : unit.currentCustomerId;
  const toLocationId =
    input.toLocationId !== undefined ? input.toLocationId : unit.currentLocationId;
  const toCustodianId =
    input.toCustodianId !== undefined ? input.toCustodianId : unit.custodianUserId;
  const nextStatus =
    input.status ||
    statusForMove(input.type, !!toCustomerId);

  const expectedReturnAt =
    input.expectedReturnAt !== undefined
      ? input.expectedReturnAt
        ? new Date(input.expectedReturnAt)
        : null
      : unit.expectedReturnAt;

  const [movement] = await prisma.$transaction([
    prisma.demoEquipmentMovement.create({
      data: {
        companyId,
        unitId,
        type: input.type,
        fromLocationId: unit.currentLocationId,
        toLocationId,
        fromCustomerId: unit.currentCustomerId,
        toCustomerId,
        fromCustodianId: unit.custodianUserId,
        toCustodianId,
        purpose: input.purpose?.trim() || null,
        notes: input.notes?.trim() || null,
        expectedReturnAt,
        createdById: createdById || null,
      },
    }),
    prisma.demoEquipmentUnit.update({
      where: { id: unitId },
      data: {
        status: nextStatus,
        currentLocationId: toLocationId,
        currentCustomerId: toCustomerId,
        custodianUserId: toCustodianId,
        expectedReturnAt,
      },
    }),
  ]);

  const updated = await getDemoUnit(companyId, unitId);
  return { movement, unit: updated };
}

export async function deleteDemoUnit(companyId: string, id: string) {
  const existing = await prisma.demoEquipmentUnit.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!existing) return null;
  await prisma.demoEquipmentUnit.delete({ where: { id } });
  return { ok: true };
}
