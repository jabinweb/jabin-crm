import type { IndustryVerticalPack } from '@/lib/industry-packs/types';

export const MANUFACTURING_PACK: IndustryVerticalPack = {
  id: 'manufacturing',
  label: 'Manufacturing',
  description: 'Inventory, installed assets, B2B accounts, and after-sales support.',
  pack: 'manufacturing',
  featureOverrides: {
    fieldService: true,
  },
  includeBaseTicketTypes: true,
  includeVerticalTicketTypes: true,
  ticketTypes: [
    {
      id: 'machine_breakdown',
      label: 'Machine Breakdown',
      description: 'Production machine or line down.',
      defaultPriority: 'CRITICAL',
      groupName: 'Maintenance',
      showEquipment: true,
      fields: [
        {
          id: 'symptom',
          label: 'Symptoms / fault',
          type: 'textarea',
          required: true,
        },
      ],
    },
    {
      id: 'preventive_maintenance',
      label: 'Preventive Maintenance',
      description: 'Scheduled PM for plant equipment.',
      defaultPriority: 'MEDIUM',
      groupName: 'Maintenance',
      showEquipment: true,
      fields: [],
    },
    {
      id: 'electrical',
      label: 'Electrical',
      description: 'Electrical fault or utility issue.',
      defaultPriority: 'HIGH',
      groupName: 'Maintenance',
      fields: [],
    },
    {
      id: 'mechanical',
      label: 'Mechanical',
      description: 'Mechanical repair or adjustment.',
      defaultPriority: 'HIGH',
      groupName: 'Maintenance',
      showEquipment: true,
      fields: [],
    },
    {
      id: 'civil_infra',
      label: 'Civil / Infrastructure',
      description: 'Building, flooring, or site infrastructure.',
      defaultPriority: 'MEDIUM',
      groupName: 'Facilities',
      fields: [
        {
          id: 'siteArea',
          label: 'Area / building',
          type: 'text',
          placeholder: 'Optional',
        },
      ],
    },
    {
      id: 'vendor_call',
      label: 'Third-Party Vendor Call',
      description: 'External contractor or OEM service visit.',
      defaultPriority: 'HIGH',
      groupName: 'Maintenance',
      showEquipment: true,
      fields: [
        {
          id: 'vendorName',
          label: 'Vendor name',
          type: 'text',
          placeholder: 'Optional',
        },
      ],
    },
  ],
  slaByPriority: {
    CRITICAL: { responseHours: 2, resolutionHours: 8 },
    HIGH: { responseHours: 8, resolutionHours: 24 },
    MEDIUM: { responseHours: 24, resolutionHours: 72 },
    LOW: { responseHours: 72, resolutionHours: 120 },
  },
  homeWidgets: ['renewals', 'sla_at_risk', 'low_stock'],
};
