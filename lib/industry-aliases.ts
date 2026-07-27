/**
 * Industry picker aliases map marketing labels → deep workspace packs.
 * Rich vertical packs (lib/industry-packs) own tickets / SLA / widgets for key industries.
 * Packs (BusinessVertical) still own base features / pipelines.
 */

import type { BusinessVertical, WorkspaceTerminology } from '@/lib/workspace-templates';
import { BUSINESS_VERTICALS, isBusinessVertical } from '@/lib/workspace-templates';
import { getIndustryVerticalPack } from '@/lib/industry-packs';

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

function fromVerticalPack(id: string): IndustryPickerOption | null {
  const p = getIndustryVerticalPack(id);
  if (!p) return null;
  return {
    id: p.id,
    label: p.label,
    description: p.description,
    pack: p.pack,
    deepTemplate: p.deepTemplate,
    terminologyOverrides: p.terminologyOverrides,
  };
}

const medical = fromVerticalPack('medical_equipment')!;
const manufacturing = fromVerticalPack('manufacturing')!;
const facilities = fromVerticalPack('facilities_management')!;
const logistics = fromVerticalPack('logistics')!;
const fmcg = fromVerticalPack('fmcg')!;
const pharma = fromVerticalPack('pharma')!;
const automotive = fromVerticalPack('automotive')!;

/** Primary grid — matches common B2B industry tiles; each resolves to a deep pack. */
export const INDUSTRY_PICKER_OPTIONS: IndustryPickerOption[] = [
  medical,
  manufacturing,
  fmcg,
  facilities,
  logistics,
  pharma,
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
  automotive,
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
