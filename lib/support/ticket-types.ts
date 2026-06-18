import type { BusinessVertical } from '@/lib/workspace-templates';
import type { ResolvedWorkspaceConfig } from '@/lib/workspace-config';
import type { TicketPriority } from '@prisma/client';

export type PortalTicketFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'select';

export interface PortalTicketField {
  id: string;
  label: string;
  type: PortalTicketFieldType;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface PortalTicketTypeDefinition {
  id: string;
  label: string;
  description: string;
  defaultPriority: TicketPriority;
  /** Route to SupportGroup.name when matched for the company */
  groupName?: string;
  showEquipment?: boolean;
  showProduct?: boolean;
  fields: PortalTicketField[];
  enabled?: boolean;
}

export interface SupportSettings {
  disabledTicketTypeIds?: string[];
  /** Admin-defined ticket types merged with vertical presets */
  customTicketTypes?: PortalTicketTypeDefinition[];
  /** Per ticket-type status pipelines (ordered TicketStatus values) */
  statusPipelines?: Record<string, string[]>;
  /** SLA overrides keyed by ticket type id */
  slaByTicketType?: Record<
    string,
    { responseHours: number; resolutionHours: number; name?: string }
  >;
  /** Which channels customers see in the portal support hub */
  channels?: {
    email?: string;
    phone?: string;
    chat?: boolean;
    whatsApp?: boolean;
  };
}

const BASE_TYPES: PortalTicketTypeDefinition[] = [
  {
    id: 'general',
    label: 'General inquiry',
    description: 'Questions, feedback, or anything that does not fit another category.',
    defaultPriority: 'MEDIUM',
    groupName: 'General Support',
    fields: [],
  },
  {
    id: 'technical',
    label: 'Technical support',
    description: 'Something is broken, slow, or not working as expected.',
    defaultPriority: 'HIGH',
    groupName: 'Technical Support',
    fields: [
      {
        id: 'affectedArea',
        label: 'Affected area',
        type: 'text',
        placeholder: 'e.g. Dashboard, API, mobile app',
      },
    ],
  },
  {
    id: 'billing',
    label: 'Billing & payments',
    description: 'Invoices, subscriptions, refunds, or payment issues.',
    defaultPriority: 'MEDIUM',
    groupName: 'Billing',
    fields: [
      {
        id: 'invoiceNumber',
        label: 'Invoice / reference #',
        type: 'text',
        placeholder: 'Optional',
      },
    ],
  },
  {
    id: 'account',
    label: 'Account & access',
    description: 'Login, permissions, user access, or profile changes.',
    defaultPriority: 'MEDIUM',
    groupName: 'Account Management',
    fields: [
      {
        id: 'affectedUser',
        label: 'Affected user email',
        type: 'email',
        placeholder: 'user@company.com',
      },
    ],
  },
  {
    id: 'feature_request',
    label: 'Feature request',
    description: 'Suggest an improvement or new capability.',
    defaultPriority: 'LOW',
    groupName: 'Product',
    fields: [
      {
        id: 'useCase',
        label: 'Use case',
        type: 'textarea',
        placeholder: 'What problem would this solve?',
      },
    ],
  },
];

const VERTICAL_TYPES: Partial<Record<BusinessVertical, PortalTicketTypeDefinition[]>> = {
  field_service: [
    {
      id: 'equipment',
      label: 'Equipment / asset issue',
      description: 'Report a fault on installed equipment or assets.',
      defaultPriority: 'HIGH',
      groupName: 'Field Service',
      showEquipment: true,
      fields: [
        {
          id: 'symptom',
          label: 'Symptoms observed',
          type: 'textarea',
          placeholder: 'Error codes, sounds, display messages…',
        },
      ],
    },
    {
      id: 'installation',
      label: 'Installation request',
      description: 'Schedule or request a new installation.',
      defaultPriority: 'MEDIUM',
      groupName: 'Field Service',
      showEquipment: true,
      fields: [],
    },
    {
      id: 'warranty',
      label: 'Warranty claim',
      description: 'Coverage, warranty status, or replacement under warranty.',
      defaultPriority: 'MEDIUM',
      groupName: 'Field Service',
      showEquipment: true,
      fields: [],
    },
  ],
  ecommerce: [
    {
      id: 'order',
      label: 'Order issue',
      description: 'Missing, delayed, or incorrect orders.',
      defaultPriority: 'HIGH',
      groupName: 'Orders',
      fields: [
        {
          id: 'orderNumber',
          label: 'Order number',
          type: 'text',
          required: true,
          placeholder: 'ORD-12345',
        },
      ],
    },
    {
      id: 'returns',
      label: 'Returns & refunds',
      description: 'Return merchandise or request a refund.',
      defaultPriority: 'MEDIUM',
      groupName: 'Orders',
      fields: [
        {
          id: 'orderNumber',
          label: 'Order number',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      id: 'product',
      label: 'Product question',
      description: 'Specs, compatibility, or availability.',
      defaultPriority: 'LOW',
      groupName: 'Product',
      showProduct: true,
      fields: [],
    },
  ],
  agency: [
    {
      id: 'project',
      label: 'Project request',
      description: 'New work, scope changes, or deliverable questions.',
      defaultPriority: 'MEDIUM',
      groupName: 'Projects',
      fields: [
        {
          id: 'projectName',
          label: 'Project name',
          type: 'text',
        },
      ],
    },
    {
      id: 'deliverable',
      label: 'Deliverable revision',
      description: 'Request changes to creative or consulting deliverables.',
      defaultPriority: 'MEDIUM',
      groupName: 'Projects',
      fields: [],
    },
  ],
  professional_services: [
    {
      id: 'engagement',
      label: 'Engagement / project',
      description: 'Questions about an active engagement or statement of work.',
      defaultPriority: 'MEDIUM',
      groupName: 'Client Services',
      fields: [
        {
          id: 'engagementName',
          label: 'Engagement name',
          type: 'text',
        },
      ],
    },
  ],
  manufacturing: [
    {
      id: 'equipment',
      label: 'Asset / equipment issue',
      description: 'Production asset or installed equipment problems.',
      defaultPriority: 'HIGH',
      groupName: 'Service Engineering',
      showEquipment: true,
      fields: [],
    },
    {
      id: 'parts',
      label: 'Parts & supplies',
      description: 'Order spare parts or consumables.',
      defaultPriority: 'MEDIUM',
      groupName: 'Parts Desk',
      fields: [
        {
          id: 'partNumber',
          label: 'Part / SKU',
          type: 'text',
        },
      ],
    },
    {
      id: 'warranty',
      label: 'Warranty claim',
      description: 'Warranty coverage or replacement requests.',
      defaultPriority: 'MEDIUM',
      groupName: 'Service Engineering',
      showEquipment: true,
      fields: [],
    },
  ],
};

export function getDefaultTicketTypesForVertical(
  vertical: BusinessVertical
): PortalTicketTypeDefinition[] {
  const extra = VERTICAL_TYPES[vertical] ?? [];
  const merged = [...BASE_TYPES, ...extra];
  const seen = new Set<string>();
  return merged.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

export function parseSupportSettings(raw: unknown): SupportSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const disabled = obj.disabledTicketTypeIds;
  const customRaw = obj.customTicketTypes;
  const pipelinesRaw = obj.statusPipelines;
  const slaRaw = obj.slaByTicketType;
  const channelsRaw = obj.channels;

  return {
    disabledTicketTypeIds: Array.isArray(disabled)
      ? disabled.filter((id): id is string => typeof id === 'string')
      : undefined,
    customTicketTypes: Array.isArray(customRaw)
      ? (customRaw as PortalTicketTypeDefinition[])
      : undefined,
    statusPipelines:
      pipelinesRaw && typeof pipelinesRaw === 'object' && !Array.isArray(pipelinesRaw)
        ? (pipelinesRaw as Record<string, string[]>)
        : undefined,
    slaByTicketType:
      slaRaw && typeof slaRaw === 'object' && !Array.isArray(slaRaw)
        ? (slaRaw as SupportSettings['slaByTicketType'])
        : undefined,
    channels:
      channelsRaw && typeof channelsRaw === 'object' && !Array.isArray(channelsRaw)
        ? (channelsRaw as SupportSettings['channels'])
        : undefined,
  };
}

export function resolvePortalTicketTypes(
  config: ResolvedWorkspaceConfig,
  supportSettings?: SupportSettings
): PortalTicketTypeDefinition[] {
  const disabled = new Set(supportSettings?.disabledTicketTypeIds ?? []);
  const preset = getDefaultTicketTypesForVertical(config.businessVertical);
  const custom = supportSettings?.customTicketTypes ?? [];

  const merged = [...preset];
  for (const customType of custom) {
    const idx = merged.findIndex((t) => t.id === customType.id);
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...customType };
    } else {
      merged.push(customType);
    }
  }

  return merged
    .filter((type) => !disabled.has(type.id))
    .map((type) => ({
      ...type,
      showEquipment:
        type.showEquipment === true && config.features.equipment === true,
      showProduct:
        type.showProduct === true && config.features.products === true,
    }));
}

export function findTicketTypeDefinition(
  types: PortalTicketTypeDefinition[],
  typeId: string
): PortalTicketTypeDefinition | undefined {
  return types.find((t) => t.id === typeId);
}

export function validateCustomFields(
  type: PortalTicketTypeDefinition,
  customFields: Record<string, string> | undefined
): string | null {
  const values = customFields ?? {};
  for (const field of type.fields) {
    const value = values[field.id]?.trim() ?? '';
    if (field.required && !value) {
      return `${field.label} is required`;
    }
  }
  return null;
}
