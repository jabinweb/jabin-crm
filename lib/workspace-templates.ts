/**
 * Workspace templates define which product areas and terminology apply per business type.
 * Templates are merged with company settings overrides at runtime.
 */

export const BUSINESS_VERTICALS = [
  'general',
  'field_service',
  'agency',
  'web_agency',
  'ecommerce',
  'professional_services',
  'manufacturing',
  'healthcare',
  'saas',
  'construction',
  'education',
  'hospitality',
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

const CRM_CLIENT_FEATURES: Record<WorkspaceFeatureKey, boolean> = {
  customerPortal: true,
  customers: true,
  customerAnalytics: true,
  inventory: false,
  equipment: false,
  fieldService: false,
  warranties: false,
  serviceHistory: false,
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
    description: 'Leads, retainers, outreach, and client relationships for creative and consulting firms.',
    features: CRM_CLIENT_FEATURES,
    terminology: {
      ...BASE_TERMINOLOGY,
      customer: 'Client',
      customers: 'Clients',
      agent: 'Account manager',
      asset: 'Deliverable',
      equipment: 'Retainer package',
      ticket: 'Request',
      newRequest: 'New client request',
      portalSubtitle: 'Track project requests, deliverables, and support with your agency.',
    },
    leadStatusFlow: ['NEW', 'DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'],
  },
  web_agency: {
    id: 'web_agency',
    label: 'Web & digital agency',
    description:
      'Websites, apps, SEO, and retainers — leads, proposals, invoices, and client requests.',
    features: {
      ...CRM_CLIENT_FEATURES,
      products: true,
    },
    terminology: {
      ...BASE_TERMINOLOGY,
      customer: 'Client',
      customers: 'Clients',
      agent: 'Project lead',
      asset: 'Website / app',
      equipment: 'Service package',
      ticket: 'Client request',
      newRequest: 'New brief / change request',
      portalSubtitle:
        'Submit briefs, track change requests, and view project updates with your digital agency.',
    },
    leadStatusFlow: [
      'NEW',
      'DISCOVERY',
      'PROPOSAL',
      'SCOPING',
      'IN_PRODUCTION',
      'WON',
      'LOST',
    ],
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
    features: CRM_CLIENT_FEATURES,
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
  healthcare: {
    id: 'healthcare',
    label: 'Healthcare & clinics',
    description: 'Patients/clients, appointments, equipment service, and support.',
    features: {
      customerPortal: true,
      customers: true,
      customerAnalytics: true,
      inventory: true,
      equipment: true,
      fieldService: true,
      warranties: true,
      serviceHistory: true,
      products: true,
    },
    terminology: {
      ...BASE_TERMINOLOGY,
      customer: 'Patient / facility',
      customers: 'Patients / facilities',
      agent: 'Biomed / clinician',
      asset: 'Medical device',
      equipment: 'Equipment',
      ticket: 'Service ticket',
      newRequest: 'Request service',
      portalSubtitle: 'Track equipment service, warranties, and support tickets.',
    },
    leadStatusFlow: ['NEW', 'DEMO', 'QUOTE', 'PROCUREMENT', 'WON', 'LOST'],
  },
  saas: {
    id: 'saas',
    label: 'SaaS & software',
    description: 'Pipeline, subscriptions packaging, customer success, and support.',
    features: {
      customerPortal: true,
      customers: true,
      customerAnalytics: true,
      inventory: false,
      equipment: false,
      fieldService: false,
      warranties: false,
      serviceHistory: false,
      products: true,
    },
    terminology: {
      ...BASE_TERMINOLOGY,
      customer: 'Account',
      customers: 'Accounts',
      agent: 'CSM',
      asset: 'Seat / workspace',
      equipment: 'Plan',
      ticket: 'Support ticket',
      newRequest: 'Open ticket',
      portalSubtitle: 'Manage support tickets, account health, and product help.',
    },
    leadStatusFlow: ['NEW', 'DEMO', 'TRIAL', 'PROPOSAL', 'WON', 'LOST', 'CHURN_RISK'],
  },
  construction: {
    id: 'construction',
    label: 'Construction & trades',
    description: 'Jobs, site visits, materials, and field crews.',
    features: {
      customerPortal: true,
      customers: true,
      customerAnalytics: true,
      inventory: true,
      equipment: true,
      fieldService: true,
      warranties: true,
      serviceHistory: true,
      products: true,
    },
    terminology: {
      ...BASE_TERMINOLOGY,
      customer: 'Client',
      customers: 'Clients',
      agent: 'Foreman',
      asset: 'Job site asset',
      equipment: 'Tools & equipment',
      ticket: 'Job request',
      newRequest: 'New job request',
      portalSubtitle: 'Track job progress, site requests, and warranties.',
    },
    leadStatusFlow: ['NEW', 'SITE_VISIT', 'ESTIMATE', 'CONTRACT', 'WON', 'LOST'],
  },
  education: {
    id: 'education',
    label: 'Education & training',
    description: 'Enrollments, programs, billing, and learner support.',
    features: CRM_CLIENT_FEATURES,
    terminology: {
      ...BASE_TERMINOLOGY,
      customer: 'Learner / org',
      customers: 'Learners / orgs',
      agent: 'Coordinator',
      ticket: 'Support request',
      newRequest: 'Ask for help',
      portalSubtitle: 'Access programs, billing, and support in one place.',
    },
    leadStatusFlow: ['NEW', 'INTERESTED', 'ENROLLED', 'ACTIVE', 'WON', 'LOST'],
  },
  hospitality: {
    id: 'hospitality',
    label: 'Hospitality & venues',
    description: 'Guests, venues, inventory, and on-site operations.',
    features: {
      customerPortal: true,
      customers: true,
      customerAnalytics: true,
      inventory: true,
      equipment: true,
      fieldService: true,
      warranties: false,
      serviceHistory: true,
      products: true,
    },
    terminology: {
      ...BASE_TERMINOLOGY,
      customer: 'Guest / group',
      customers: 'Guests / groups',
      agent: 'Operations',
      ticket: 'Service request',
      newRequest: 'Request service',
      portalSubtitle: 'Submit service requests and view venue updates.',
    },
    leadStatusFlow: ['NEW', 'INQUIRY', 'QUOTE', 'BOOKED', 'WON', 'LOST'],
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
