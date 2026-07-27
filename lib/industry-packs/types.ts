import type { TicketPriority } from '@prisma/client';
import type {
  BusinessVertical,
  WorkspaceFeatureKey,
  WorkspaceTerminology,
} from '@/lib/workspace-templates';

/** Mirrors PortalTicketTypeDefinition without importing ticket-types (avoids cycles). */
export type IndustryTicketTypeDefinition = {
  id: string;
  label: string;
  description: string;
  defaultPriority: TicketPriority;
  groupName?: string;
  showEquipment?: boolean;
  showProduct?: boolean;
  fields: Array<{
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'select';
    required?: boolean;
    placeholder?: string;
    options?: Array<{ value: string; label: string }>;
  }>;
};

export type IndustryHomeWidget =
  | 'renewals'
  | 'sla_at_risk'
  | 'low_stock'
  | 'open_work_orders'
  | 'delivery_exceptions';

export type IndustrySlaByPriority = Record<
  TicketPriority,
  { responseHours: number; resolutionHours: number }
>;

export type IndustryAutomationKind =
  | 'contract_renewal_remind'
  | 'pm_due_create_ticket'
  | 'sla_customer_notify';

export type IndustryPackAutomation = {
  id: string;
  name: string;
  enabled: boolean;
  kind: IndustryAutomationKind;
  config?: Record<string, unknown>;
};

/**
 * Per-industry vertical pack: unique defaults on shared CRM engines.
 * Deep `pack` (BusinessVertical) still owns base features / lead flow.
 */
export type IndustryVerticalPack = {
  id: string;
  label: string;
  description: string;
  /** Deep workspace template */
  pack: BusinessVertical;
  deepTemplate?: boolean;
  terminologyOverrides?: Partial<WorkspaceTerminology>;
  /** Applied on top of deep pack features when alias is selected */
  featureOverrides?: Partial<Record<WorkspaceFeatureKey, boolean>>;
  /**
   * When true (default), merge BASE types then append ticketTypes.
   * When false, industry ticketTypes are primary (still optional base).
   */
  includeBaseTicketTypes?: boolean;
  includeVerticalTicketTypes?: boolean;
  ticketTypes: IndustryTicketTypeDefinition[];
  slaByPriority: IndustrySlaByPriority;
  automations?: IndustryPackAutomation[];
  homeWidgets?: IndustryHomeWidget[];
};

export const DEFAULT_SLA_BY_PRIORITY: IndustrySlaByPriority = {
  CRITICAL: { responseHours: 1, resolutionHours: 8 },
  HIGH: { responseHours: 2, resolutionHours: 24 },
  MEDIUM: { responseHours: 4, resolutionHours: 48 },
  LOW: { responseHours: 8, resolutionHours: 72 },
};
