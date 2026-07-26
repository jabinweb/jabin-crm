import { describe, expect, it } from '@jest/globals';
import {
  buildInitialCompanySettings,
  buildVerticalSwitchPatch,
  parseWorkspaceSettings,
  resolveWorkspaceConfig,
  selectionIdForWorkspace,
  workspaceSettingsFromCompanySettings,
} from '@/lib/workspace-config';
import {
  BUSINESS_VERTICALS,
  WORKSPACE_TEMPLATES,
  type WorkspaceFeatureKey,
} from '@/lib/workspace-templates';
import {
  PRIMARY_INDUSTRY_PICKER_OPTIONS,
  assertPacksCovered,
  resolveIndustrySelection,
} from '@/lib/industry-aliases';

/** Expected industry pack feature matrix — keep in sync with WORKSPACE_TEMPLATES. */
const FEATURE_SNAPSHOT: Record<
  (typeof BUSINESS_VERTICALS)[number],
  Record<WorkspaceFeatureKey, boolean>
> = {
  general: {
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
  field_service: {
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
  agency: {
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
  web_agency: {
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
  ecommerce: {
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
  professional_services: {
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
  manufacturing: {
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
  healthcare: {
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
  saas: {
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
  construction: {
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
  education: {
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
  hospitality: {
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
};

describe('workspace-config', () => {
  it('defaults to general business template', () => {
    const config = resolveWorkspaceConfig(parseWorkspaceSettings(undefined));
    expect(config.businessVertical).toBe('general');
    expect(config.features.equipment).toBe(false);
    expect(config.features.fieldService).toBe(false);
    expect(config.features.customers).toBe(true);
  });

  it('applies field service template features', () => {
    const config = resolveWorkspaceConfig({
      businessVertical: 'field_service',
    });
    expect(config.features.equipment).toBe(true);
    expect(config.features.fieldService).toBe(true);
    expect(config.terminology.agent).toBe('Technician');
  });

  it('respects feature overrides on top of template', () => {
    const config = resolveWorkspaceConfig({
      businessVertical: 'agency',
      featureOverrides: { inventory: true },
    });
    expect(config.features.inventory).toBe(true);
    expect(config.features.equipment).toBe(false);
  });

  it('applies web agency template for digital firms', () => {
    const config = resolveWorkspaceConfig({
      businessVertical: 'web_agency',
    });
    expect(config.terminology.customers).toBe('Clients');
    expect(config.terminology.ticket).toBe('Client request');
    expect(config.terminology.leads).toBe('Prospects');
    expect(config.features.products).toBe(true);
    expect(config.features.fieldService).toBe(false);
  });

  it('reads legacy top-level businessVertical from company settings', () => {
    const settings = workspaceSettingsFromCompanySettings({
      onboarding: { completed: true },
      businessVertical: 'field_service',
    });
    expect(settings.businessVertical).toBe('field_service');
  });

  it('seeds lead pipeline stages from template flow', () => {
    const initial = buildInitialCompanySettings('manufacturing');
    expect(initial.pipelines.leads.stages).toContain('NEW');
    expect(initial.pipelines.leads.stages).toContain('WON');
    expect(initial.pipelines.leads.labels?.QUALIFIED).toBe('Rfq');
    expect(initial.pipelines.leads.labels?.PROPOSAL).toBe('Quote');
    expect(initial.pipelines.leads.labels?.NEGOTIATION).toBe('Po');
  });

  it('seeds company billing.defaultCurrency', () => {
    const initial = buildInitialCompanySettings('general');
    expect(initial.billing.defaultCurrency).toBe('INR');
  });

  it('matches industry pack feature matrix for every vertical', () => {
    for (const vertical of BUSINESS_VERTICALS) {
      const config = resolveWorkspaceConfig({ businessVertical: vertical });
      expect(config.features).toEqual(FEATURE_SNAPSHOT[vertical]);
      expect(WORKSPACE_TEMPLATES[vertical].features).toEqual(FEATURE_SNAPSHOT[vertical]);
    }
  });

  it('ecommerce enables inventory without equipment', () => {
    const config = resolveWorkspaceConfig({ businessVertical: 'ecommerce' });
    expect(config.features.inventory).toBe(true);
    expect(config.features.equipment).toBe(false);
    expect(config.features.fieldService).toBe(false);
  });

  it('resolves medical equipment alias to field_service pack with biomed labels', () => {
    const resolved = resolveIndustrySelection('medical_equipment');
    expect(resolved.businessVertical).toBe('field_service');
    expect(resolved.deepTemplate).toBe(true);

    const seeded = buildInitialCompanySettings(resolved.businessVertical, {
      industryAlias: resolved.industryAlias,
    });
    expect(seeded.workspace.industryAlias).toBe('medical_equipment');
    expect(seeded.workspace.businessVertical).toBe('field_service');

    const config = resolveWorkspaceConfig(seeded.workspace);
    expect(config.verticalLabel).toBe('Medical Equipment');
    expect(config.terminology.agent).toBe('Biomed engineer');
    expect(config.features.fieldService).toBe(true);
  });

  it('maps primary industry tiles to deep packs', () => {
    const expectedPacks: Record<string, string> = {
      medical_equipment: 'field_service',
      manufacturing: 'manufacturing',
      fmcg: 'ecommerce',
      facilities_management: 'field_service',
      logistics: 'manufacturing',
      pharma: 'manufacturing',
      retail: 'ecommerce',
      construction: 'construction',
      automotive: 'field_service',
      professional_services: 'professional_services',
      financial_services: 'professional_services',
      education: 'education',
    };
    expect(PRIMARY_INDUSTRY_PICKER_OPTIONS).toHaveLength(12);
    for (const opt of PRIMARY_INDUSTRY_PICKER_OPTIONS) {
      expect(resolveIndustrySelection(opt.id).businessVertical).toBe(expectedPacks[opt.id]);
    }
  });

  it('covers every deep pack with at least one picker option', () => {
    expect(assertPacksCovered()).toEqual([]);
  });

  it('buildVerticalSwitchPatch stores alias and clears overrides', () => {
    const patch = buildVerticalSwitchPatch('retail');
    expect(patch.workspace.businessVertical).toBe('ecommerce');
    expect(patch.workspace.industryAlias).toBe('retail');
    expect(patch.workspace.featureOverrides).toBeNull();
    expect(
      selectionIdForWorkspace({
        businessVertical: patch.workspace.businessVertical as 'ecommerce',
        industryAlias: patch.workspace.industryAlias,
      })
    ).toBe('retail');
  });
});
