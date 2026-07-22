import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAppBaseUrl } from '@/lib/app-url';

export type ServiceRequestScope =
  | { kind: 'customer'; customerId: string }
  | { kind: 'equipment'; equipmentId: string; customerId: string };

function newServiceToken() {
  return randomBytes(24).toString('base64url');
}

export function serviceRequestPublicUrl(token: string): string {
  return `${getAppBaseUrl()}/service-request/${token}`;
}

export async function ensureCustomerServiceToken(customerId: string, rotate = false) {
  const existing = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, serviceRequestToken: true, organizationName: true },
  });
  if (!existing) throw new Error('Customer not found');

  if (existing.serviceRequestToken && !rotate) {
    return {
      token: existing.serviceRequestToken,
      url: serviceRequestPublicUrl(existing.serviceRequestToken),
      organizationName: existing.organizationName,
    };
  }

  const token = newServiceToken();
  await prisma.customer.update({
    where: { id: customerId },
    data: { serviceRequestToken: token },
  });

  return {
    token,
    url: serviceRequestPublicUrl(token),
    organizationName: existing.organizationName,
  };
}

export async function ensureEquipmentServiceToken(equipmentId: string, rotate = false) {
  const existing = await prisma.equipmentInstallation.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      customerId: true,
      serviceRequestToken: true,
      serialNumber: true,
      product: { select: { name: true, modelNumber: true } },
      customer: { select: { organizationName: true } },
    },
  });
  if (!existing) throw new Error('Equipment not found');

  if (existing.serviceRequestToken && !rotate) {
    return {
      token: existing.serviceRequestToken,
      url: serviceRequestPublicUrl(existing.serviceRequestToken),
      organizationName: existing.customer.organizationName,
      equipmentLabel:
        existing.product.name +
        (existing.serialNumber ? ` · S/N ${existing.serialNumber}` : ''),
    };
  }

  const token = newServiceToken();
  await prisma.equipmentInstallation.update({
    where: { id: equipmentId },
    data: { serviceRequestToken: token },
  });

  return {
    token,
    url: serviceRequestPublicUrl(token),
    organizationName: existing.customer.organizationName,
    equipmentLabel:
      existing.product.name +
      (existing.serialNumber ? ` · S/N ${existing.serialNumber}` : ''),
  };
}

export async function resolveServiceRequestToken(token: string): Promise<ServiceRequestScope | null> {
  if (!token || token.length < 8) return null;

  const equipment = await prisma.equipmentInstallation.findFirst({
    where: { serviceRequestToken: token, status: 'ACTIVE' },
    select: { id: true, customerId: true },
  });
  if (equipment) {
    return {
      kind: 'equipment',
      equipmentId: equipment.id,
      customerId: equipment.customerId,
    };
  }

  const customer = await prisma.customer.findFirst({
    where: { serviceRequestToken: token },
    select: { id: true },
  });
  if (customer) {
    return { kind: 'customer', customerId: customer.id };
  }

  return null;
}
