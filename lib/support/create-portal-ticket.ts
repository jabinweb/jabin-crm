import { prisma } from '@/lib/prisma';
import { ticketService, type CreateTicketData } from '@/lib/crm/ticket-service';
import {
  findTicketTypeDefinition,
  validateCustomFields,
} from '@/lib/support/ticket-types';
import {
  resolveCompanyTicketConfig,
  resolveGroupIdForTicketType,
} from '@/lib/support/resolve-company-ticket-config';

export type PortalTicketPayload = {
  ticketType: string;
  subject: string;
  description: string;
  priority?: CreateTicketData['priority'];
  equipmentId?: string;
  customFields?: Record<string, string>;
};

export async function createPortalTicket(
  customerId: string,
  payload: PortalTicketPayload
) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { companyId: true },
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  const { ticketTypes } = await resolveCompanyTicketConfig(customer.companyId);
  const typeDef = findTicketTypeDefinition(ticketTypes, payload.ticketType);

  if (!typeDef) {
    throw new Error('Invalid ticket type');
  }

  const fieldError = validateCustomFields(typeDef, payload.customFields);
  if (fieldError) {
    throw new Error(fieldError);
  }

  if (typeDef.showEquipment && payload.equipmentId) {
    const equipment = await prisma.equipmentInstallation.findFirst({
      where: { id: payload.equipmentId, customerId },
      select: { id: true },
    });
    if (!equipment) {
      throw new Error('Invalid equipment selection');
    }
  }

  const groupId = await resolveGroupIdForTicketType(customer.companyId, typeDef);

  return ticketService.createTicket({
    customerId,
    subject: payload.subject.trim(),
    description: payload.description.trim(),
    priority: payload.priority ?? typeDef.defaultPriority,
    channel: 'PORTAL',
    ticketType: typeDef.id,
    groupId,
    companyId: customer.companyId,
    equipmentId:
      typeDef.showEquipment && payload.equipmentId && payload.equipmentId !== 'GENERAL'
        ? payload.equipmentId
        : undefined,
    customFields: payload.customFields,
    tags: [typeDef.label],
  });
}
