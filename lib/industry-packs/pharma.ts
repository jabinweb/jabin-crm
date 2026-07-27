import type { IndustryVerticalPack } from '@/lib/industry-packs/types';

export const PHARMA_PACK: IndustryVerticalPack = {
  id: 'pharma',
  label: 'Pharma',
  description: 'Batch-aware inventory, quality assets, and regulated account support.',
  pack: 'manufacturing',
  terminologyOverrides: {
    customer: 'Account',
    customers: 'Accounts',
    agent: 'QA / service',
    asset: 'Equipment',
    equipment: 'Equipment',
    ticket: 'Quality case',
    tickets: 'Quality cases',
    lead: 'Account lead',
    leads: 'Account leads',
    deal: 'Supply deal',
    deals: 'Supply deals',
    portalSubtitle: 'Track quality cases, batches, and account support.',
  },
  featureOverrides: {
    fieldService: true,
    inventory: true,
  },
  includeBaseTicketTypes: true,
  includeVerticalTicketTypes: true,
  ticketTypes: [
    {
      id: 'quality_deviation',
      label: 'Quality deviation',
      description: 'Process or product quality deviation.',
      defaultPriority: 'HIGH',
      groupName: 'Quality',
      fields: [
        { id: 'batchLot', label: 'Batch / lot #', type: 'text', placeholder: 'Optional' },
      ],
    },
    {
      id: 'batch_issue',
      label: 'Batch / inventory issue',
      description: 'Expiry, quarantine, or stock discrepancy.',
      defaultPriority: 'HIGH',
      groupName: 'Quality',
      showProduct: true,
      fields: [
        { id: 'batchLot', label: 'Batch / lot #', type: 'text', required: true },
      ],
    },
    {
      id: 'cold_chain',
      label: 'Cold chain excursion',
      description: 'Temperature excursion during storage or transit.',
      defaultPriority: 'CRITICAL',
      groupName: 'Quality',
      fields: [
        { id: 'batchLot', label: 'Batch / lot #', type: 'text', required: true },
      ],
    },
    {
      id: 'equipment_calibration',
      label: 'Equipment calibration',
      description: 'Lab or production equipment calibration due.',
      defaultPriority: 'MEDIUM',
      groupName: 'Quality',
      showEquipment: true,
      fields: [],
    },
  ],
  slaByPriority: {
    CRITICAL: { responseHours: 2, resolutionHours: 8 },
    HIGH: { responseHours: 4, resolutionHours: 24 },
    MEDIUM: { responseHours: 24, resolutionHours: 72 },
    LOW: { responseHours: 72, resolutionHours: 120 },
  },
  homeWidgets: ['low_stock', 'sla_at_risk', 'renewals'],
};
