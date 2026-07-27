import type { IndustryVerticalPack } from '@/lib/industry-packs/types';

/** Graphoid-parity medical equipment vertical pack. */
export const MEDICAL_EQUIPMENT_PACK: IndustryVerticalPack = {
  id: 'medical_equipment',
  label: 'Medical Equipment',
  description:
    'Installed devices, AMC/CMC, biomed field service, and hospital accounts.',
  pack: 'field_service',
  deepTemplate: true,
  terminologyOverrides: {
    customer: 'Hospital / facility',
    customers: 'Hospitals / facilities',
    agent: 'Biomed engineer',
    asset: 'Medical device',
    equipment: 'Medical equipment',
    ticket: 'Service ticket',
    tickets: 'Service tickets',
    lead: 'Equipment lead',
    leads: 'Equipment leads',
    deal: 'Equipment deal',
    deals: 'Equipment deals',
    newRequest: 'Request service',
    portalSubtitle:
      'Manage medical devices, warranties, and service tickets for your facilities.',
  },
  includeBaseTicketTypes: true,
  includeVerticalTicketTypes: true,
  ticketTypes: [
    {
      id: 'device_breakdown',
      label: 'Equipment Breakdown',
      description: 'Critical medical device down or unsafe to use.',
      defaultPriority: 'CRITICAL',
      groupName: 'Biomed',
      showEquipment: true,
      fields: [
        {
          id: 'symptom',
          label: 'Symptoms / error codes',
          type: 'textarea',
          required: true,
        },
      ],
    },
    {
      id: 'preventive_maintenance',
      label: 'Preventive Maintenance',
      description: 'Scheduled or due PM for a medical device.',
      defaultPriority: 'MEDIUM',
      groupName: 'Biomed',
      showEquipment: true,
      fields: [
        {
          id: 'pmDueDate',
          label: 'PM due date',
          type: 'text',
          placeholder: 'YYYY-MM-DD',
        },
      ],
    },
    {
      id: 'calibration',
      label: 'Calibration',
      description: 'Calibration or metrology job for a device.',
      defaultPriority: 'HIGH',
      groupName: 'Biomed',
      showEquipment: true,
      fields: [],
    },
    {
      id: 'amc_service_visit',
      label: 'AMC Service Visit',
      description: 'Contractual service visit under an active AMC/CMC.',
      defaultPriority: 'MEDIUM',
      groupName: 'Biomed',
      showEquipment: true,
      fields: [],
    },
  ],
  slaByPriority: {
    CRITICAL: { responseHours: 4, resolutionHours: 24 },
    HIGH: { responseHours: 8, resolutionHours: 48 },
    MEDIUM: { responseHours: 24, resolutionHours: 72 },
    LOW: { responseHours: 72, resolutionHours: 120 },
  },
  automations: [
    {
      id: 'med_contract_renewal_30_7',
      name: 'AMC renewal reminders',
      enabled: true,
      kind: 'contract_renewal_remind',
      config: { daysBefore: [30, 7] },
    },
    {
      id: 'med_pm_due_ticket',
      name: 'Create ticket when PM is due',
      enabled: true,
      kind: 'pm_due_create_ticket',
      config: { ticketTypeId: 'preventive_maintenance', leadDays: 0 },
    },
    {
      id: 'med_sla_customer_notify',
      name: 'Notify customer on SLA delay',
      enabled: true,
      kind: 'sla_customer_notify',
    },
  ],
  homeWidgets: ['renewals', 'sla_at_risk'],
};
