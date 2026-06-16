import { describe, expect, it } from '@jest/globals';
import {
  buildInitialCompanySettings,
  parseWorkspaceSettings,
  resolveWorkspaceConfig,
} from '@/lib/workspace-config';

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

  it('seeds lead pipeline from template on company create', () => {
    const settings = buildInitialCompanySettings('ecommerce');
    expect(settings.workspace.businessVertical).toBe('ecommerce');
    expect(settings.leads.statusFlow).toContain('ORDER');
  });
});
