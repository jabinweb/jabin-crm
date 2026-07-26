/**
 * Industry picker aliases map marketing labels → deep workspace packs.
 * Packs (BusinessVertical) still own features / pipelines / ticket presets.
 * Aliases only refine label + optional terminology for signup and settings UI.
 */

import type { BusinessVertical, WorkspaceTerminology } from '@/lib/workspace-templates';
import { BUSINESS_VERTICALS, isBusinessVertical } from '@/lib/workspace-templates';

export interface IndustryPickerOption {
  id: string;
  label: string;
  description: string;
  /** Deep pack that actually configures the product */
  pack: BusinessVertical;
  /** Highlight as a rich ops template (e.g. medical equipment) */
  deepTemplate?: boolean;
  terminologyOverrides?: Partial<WorkspaceTerminology>;
}

/** Primary grid — matches common B2B industry tiles; each resolves to a deep pack. */
export const INDUSTRY_PICKER_OPTIONS: IndustryPickerOption[] = [
  {
    id: 'medical_equipment',
    label: 'Medical Equipment',
    description: 'Installed devices, AMC/CMC, biomed field service, and hospital accounts.',
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
  },
  {
    id: 'manufacturing',
    label: 'Manufacturing',
    description: 'Inventory, installed assets, B2B accounts, and after-sales support.',
    pack: 'manufacturing',
  },
  {
    id: 'fmcg',
    label: 'FMCG',
    description: 'Product catalog, stock, orders, and retail / distributor support.',
    pack: 'ecommerce',
    terminologyOverrides: {
      customer: 'Distributor / retailer',
      customers: 'Distributors / retailers',
      asset: 'SKU',
      equipment: 'SKU',
      lead: 'Trade lead',
      leads: 'Trade leads',
      deal: 'Order',
      deals: 'Orders',
      portalSubtitle: 'Track orders, stock, and account support.',
    },
  },
  {
    id: 'facilities_management',
    label: 'Facilities Management',
    description: 'Sites, work orders, technicians, and on-site service operations.',
    pack: 'field_service',
    terminologyOverrides: {
      customer: 'Site / client',
      customers: 'Sites / clients',
      agent: 'Technician',
      asset: 'Site asset',
      equipment: 'Assets',
      ticket: 'Work order',
      tickets: 'Work orders',
      lead: 'Site lead',
      leads: 'Site leads',
      deal: 'Contract',
      deals: 'Contracts',
      newRequest: 'New work order',
      portalSubtitle: 'Submit work orders and track facility service.',
    },
  },
  {
    id: 'logistics',
    label: 'Logistics',
    description: 'Fleet assets, inventory, B2B accounts, and ops support.',
    pack: 'manufacturing',
    terminologyOverrides: {
      customer: 'Shipper / partner',
      customers: 'Shippers / partners',
      agent: 'Ops coordinator',
      asset: 'Fleet asset',
      equipment: 'Fleet & assets',
      ticket: 'Ops ticket',
      tickets: 'Ops tickets',
      lead: 'Lane lead',
      leads: 'Lane leads',
      deal: 'Contract',
      deals: 'Contracts',
      portalSubtitle: 'Track shipments support, assets, and account activity.',
    },
  },
  {
    id: 'pharma',
    label: 'Pharma',
    description: 'Batch-aware inventory, quality assets, and regulated account support.',
    pack: 'manufacturing',
    terminologyOverrides: {
      customer: 'Account',
      customers: 'Accounts',
      agent: 'QA / service',
      asset: 'Equipment',
      equipment: 'Lab / plant equipment',
      ticket: 'Quality / service ticket',
      tickets: 'Quality / service tickets',
      lead: 'RFQ',
      leads: 'RFQs',
      deal: 'Supply deal',
      deals: 'Supply deals',
      portalSubtitle: 'Track equipment, batches, and support for your operations.',
    },
  },
  {
    id: 'retail',
    label: 'Retail',
    description: 'Catalog, inventory, orders, and customer support.',
    pack: 'ecommerce',
    terminologyOverrides: {
      customer: 'Customer',
      customers: 'Customers',
      asset: 'Product',
      equipment: 'Product',
      lead: 'Buyer lead',
      leads: 'Buyer leads',
      deal: 'Order',
      deals: 'Orders',
      portalSubtitle: 'View orders, product support, and account help.',
    },
  },
  {
    id: 'construction',
    label: 'Construction',
    description: 'Jobs, site visits, materials, and field crews.',
    pack: 'construction',
  },
  {
    id: 'automotive',
    label: 'Automotive',
    description: 'Dealership / workshop service, parts stock, and field units.',
    pack: 'field_service',
    terminologyOverrides: {
      customer: 'Dealer / fleet',
      customers: 'Dealers / fleets',
      agent: 'Service advisor',
      asset: 'Vehicle / unit',
      equipment: 'Vehicles & equipment',
      ticket: 'Service job',
      tickets: 'Service jobs',
      lead: 'Service lead',
      leads: 'Service leads',
      deal: 'Service deal',
      deals: 'Service deals',
      newRequest: 'Book service',
      portalSubtitle: 'Track service jobs, warranties, and vehicle history.',
    },
  },
  {
    id: 'professional_services',
    label: 'Professional Services',
    description: 'Clients, engagements, billing, and cases — without field ops.',
    pack: 'professional_services',
  },
  {
    id: 'financial_services',
    label: 'Financial Services',
    description: 'Clients, cases, and relationship pipelines for advisory firms.',
    pack: 'professional_services',
    terminologyOverrides: {
      customer: 'Client',
      customers: 'Clients',
      agent: 'Relationship manager',
      ticket: 'Case',
      tickets: 'Cases',
      lead: 'Prospect',
      leads: 'Prospects',
      deal: 'Mandate',
      deals: 'Mandates',
      newRequest: 'Open a case',
      portalSubtitle: 'Access cases, documents, and account updates.',
    },
  },
  {
    id: 'education',
    label: 'Education',
    description: 'Enrollments, programs, billing, and learner support.',
    pack: 'education',
  },
  // Additional deep packs (not on the primary industry tile set)
  {
    id: 'healthcare',
    label: 'Healthcare & clinics',
    description: 'Patients/facilities, equipment service, and clinical support.',
    pack: 'healthcare',
  },
  {
    id: 'field_service',
    label: 'Field service & equipment',
    description: 'Installed assets, warranties, technicians, and on-site service.',
    pack: 'field_service',
    deepTemplate: true,
  },
  {
    id: 'ecommerce',
    label: 'E-commerce',
    description: 'Online catalog, inventory, orders, and support.',
    pack: 'ecommerce',
  },
  {
    id: 'web_agency',
    label: 'Web & digital agency',
    description: 'Projects, retainers, proposals, and client requests.',
    pack: 'web_agency',
  },
  {
    id: 'agency',
    label: 'Agency & consulting',
    description: 'Prospects, retainers, and client relationships.',
    pack: 'agency',
  },
  {
    id: 'saas',
    label: 'SaaS & software',
    description: 'Trials, subscriptions, CSMs, and product support.',
    pack: 'saas',
  },
  {
    id: 'hospitality',
    label: 'Hospitality & venues',
    description: 'Guests, venues, inventory, and on-site operations.',
    pack: 'hospitality',
  },
  {
    id: 'general',
    label: 'General business',
    description: 'CRM, support desk, and HRMS for any organization.',
    pack: 'general',
  },
];

/** Screenshot-style primary tiles (first 12 aliases). */
export const PRIMARY_INDUSTRY_PICKER_OPTIONS = INDUSTRY_PICKER_OPTIONS.slice(0, 12);

const OPTION_BY_ID = new Map(INDUSTRY_PICKER_OPTIONS.map((o) => [o.id, o]));

export function isIndustryAliasId(value: unknown): value is string {
  return typeof value === 'string' && OPTION_BY_ID.has(value);
}

/** Accept alias id or raw BusinessVertical (legacy). */
export function isIndustrySelection(value: unknown): boolean {
  return isIndustryAliasId(value) || isBusinessVertical(value);
}

export function getIndustryPickerOption(id: string | undefined | null): IndustryPickerOption | undefined {
  if (!id) return undefined;
  return OPTION_BY_ID.get(id);
}

export interface ResolvedIndustrySelection {
  industryAlias: string;
  businessVertical: BusinessVertical;
  label: string;
  description: string;
  deepTemplate: boolean;
  terminologyOverrides?: Partial<WorkspaceTerminology>;
}

export function resolveIndustrySelection(selection: string): ResolvedIndustrySelection {
  const option = OPTION_BY_ID.get(selection);
  if (option) {
    return {
      industryAlias: option.id,
      businessVertical: option.pack,
      label: option.label,
      description: option.description,
      deepTemplate: option.deepTemplate === true,
      terminologyOverrides: option.terminologyOverrides,
    };
  }

  if (isBusinessVertical(selection)) {
    const packOption = OPTION_BY_ID.get(selection);
    return {
      industryAlias: selection,
      businessVertical: selection,
      label: packOption?.label ?? selection,
      description: packOption?.description ?? '',
      deepTemplate: packOption?.deepTemplate === true,
      terminologyOverrides: packOption?.terminologyOverrides,
    };
  }

  // Fallback
  return {
    industryAlias: 'general',
    businessVertical: 'general',
    label: 'General business',
    description: '',
    deepTemplate: false,
  };
}

/** Landing / marketing chips — primary industry labels. */
export const LANDING_INDUSTRY_LABELS = PRIMARY_INDUSTRY_PICKER_OPTIONS.map((o) => o.label);

/** Ensure every deep pack has at least one picker entry (dev sanity). */
export function assertPacksCovered(): BusinessVertical[] {
  const covered = new Set(INDUSTRY_PICKER_OPTIONS.map((o) => o.pack));
  return BUSINESS_VERTICALS.filter((v) => !covered.has(v));
}
