import { describe, expect, it } from '@jest/globals';
import {
  buildInitialCompanySettings,
  parseWorkspaceSettings,
  resolveWorkspaceConfig,
  workspaceSettingsFromCompanySettings,
} from '@/lib/workspace-config';
import {
  BUSINESS_VERTICALS,
  WORKSPACE_TEMPLATES,
  type WorkspaceFeatureKey,
} from '@/lib/workspace-templates';

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
});
