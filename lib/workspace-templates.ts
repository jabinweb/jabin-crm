/**
 * Workspace templates define which product areas and terminology apply per business type.
 * Templates are merged with company settings overrides at runtime.
 */

export const BUSINESS_VERTICALS = [
  'general',
  'field_service',
  'agency',
  'ecommerce',
  'professional_services',
  'manufacturing',
] as const;

export type BusinessVertical = (typeof BUSINESS_VERTICALS)[number];

export type WorkspaceFeatureKey =
  | 'customerPortal'
  | 'customers'
  | 'customerAnalytics'
  | 'inventory'
  | 'equipment'
  | 'fieldService'
  | 'warranties'
  | 'serviceHistory'
  | 'products';

export interface WorkspaceTerminology {
  customer: string;
  customers: string;
  agent: string;
  asset: string;
  equipment: string;
  ticket: string;
  newRequest: string;
  portalSubtitle: string;
}

export interface WorkspaceTemplate {
  id: BusinessVertical;
  label: string;
  description: string;
  features: Record<WorkspaceFeatureKey, boolean>;
  terminology: WorkspaceTerminology;
  leadStatusFlow: string[];
}

const BASE_TERMINOLOGY: WorkspaceTerminology = {
  customer: 'Customer',
  customers: 'Customers',
  agent: 'Agent',
  asset: 'Asset',
  equipment: 'Equipment',
  ticket: 'Ticket',
  newRequest: 'New request',
  portalSubtitle: 'Manage support, account activity, and self-service for your organization.',
};

const ALL_FEATURES_ON: Record<WorkspaceFeatureKey, boolean> = {
  customerPortal: true,
  customers: true,
  customerAnalytics: true,
  inventory: true,
  equipment: true,
  fieldService: true,
  warranties: true,
  serviceHistory: true,
  products: true,
};

export const WORKSPACE_TEMPLATES: Record<BusinessVertical, WorkspaceTemplate> = {
  general: {
    id: 'general',
    label: 'General business',
    description: 'CRM, support desk, and HRMS for any organization.',
    features: {
      customerPortal: true,
      customers: true,
      customerAnalytics: true,
      inventory: false,
      equipment: false,
      fieldService: false,
      warranties: false,
      serviceHistory: false,
      products: false,
    },
    terminology: BASE_TERMINOLOGY,
    leadStatusFlow: ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'],
  },
  field_service: {
    id: 'field_service',
    label: 'Field service & equipment',
    description: 'Installed assets, warranties, technicians, and on-site service.',
    features: ALL_FEATURES_ON,
    terminology: {
      ...BASE_TERMINOLOGY,
      agent: 'Technician',
      asset: 'Installed unit',
      equipment: 'Equipment',
      portalSubtitle:
        'Manage installed equipment, support tickets, warranties, and service history.',
    },
    leadStatusFlow: ['NEW', 'SITE_VISIT', 'QUOTED', 'SCHEDULED', 'WON', 'LOST'],
  },
  agency: {
    id: 'agency',
    label: 'Agency & consulting',
    description: 'Leads, deals, outreach, and client relationships.',
    features: {
      customerPortal: true,
      customers: true,
      customerAnalytics: true,
      inventory: false,
      equipment: false,
      fieldService: false,
      warranties: false,
      serviceHistory: false,
      products: false,
    },
    terminology: {
      ...BASE_TERMINOLOGY,
      customer: 'Client',
      customers: 'Clients',
      agent: 'Account manager',
      ticket: 'Request',
      newRequest: 'New client request',
      portalSubtitle: 'Track project requests, deliverables, and support with your agency.',
    },
    leadStatusFlow: ['NEW', 'DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'],
  },
  ecommerce: {
    id: 'ecommerce',
    label: 'E-commerce & retail',
    description: 'Product catalog, inventory, orders, and customer support.',
    features: {
      customerPortal: true,
      customers: true,
      customerAnalytics: true,
      inventory: true,
      equipment: false,
      fieldService: false,
      warranties: false,
      serviceHistory: false,
      products: true,
    },
    terminology: {
      ...BASE_TERMINOLOGY,
      asset: 'Product',
      equipment: 'Product',
      portalSubtitle: 'View orders, product support, and account help in one place.',
    },
    leadStatusFlow: ['NEW', 'CONTACTED', 'QUALIFIED', 'ORDER', 'WON', 'LOST'],
  },
  professional_services: {
    id: 'professional_services',
    label: 'Professional services',
    description: 'Clients, projects, billing, and support without field operations.',
    features: {
      customerPortal: true,
      customers: true,
      customerAnalytics: true,
      inventory: false,
      equipment: false,
      fieldService: false,
      warranties: false,
      serviceHistory: false,
      products: false,
    },
    terminology: {
      ...BASE_TERMINOLOGY,
      customer: 'Client',
      customers: 'Clients',
      agent: 'Consultant',
      ticket: 'Case',
      newRequest: 'Open a case',
      portalSubtitle: 'Access support cases, documents, and service updates.',
    },
    leadStatusFlow: ['NEW', 'QUALIFIED', 'PROPOSAL', 'CONTRACT', 'WON', 'LOST'],
  },
  manufacturing: {
    id: 'manufacturing',
    label: 'Manufacturing & distribution',
    description: 'Inventory, assets, B2B customers, and after-sales support.',
    features: {
      customerPortal: true,
      customers: true,
      customerAnalytics: true,
      inventory: true,
      equipment: true,
      fieldService: false,
      warranties: true,
      serviceHistory: true,
      products: true,
    },
    terminology: {
      ...BASE_TERMINOLOGY,
      asset: 'Asset',
      equipment: 'Installed asset',
      agent: 'Service engineer',
      portalSubtitle: 'Track assets, warranties, and support for your operations.',
    },
    leadStatusFlow: ['NEW', 'RFQ', 'QUOTE', 'PO', 'WON', 'LOST'],
  },
};

export const BUSINESS_VERTICAL_OPTIONS = BUSINESS_VERTICALS.map((id) => ({
  id,
  label: WORKSPACE_TEMPLATES[id].label,
  description: WORKSPACE_TEMPLATES[id].description,
}));

export function isBusinessVertical(value: unknown): value is BusinessVertical {
  return typeof value === 'string' && BUSINESS_VERTICALS.includes(value as BusinessVertical);
}
