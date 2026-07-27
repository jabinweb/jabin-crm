import { getIndustryVerticalPack, listIndustryVerticalPacks } from '@/lib/industry-packs';
import { getDefaultTicketTypesForVertical } from '@/lib/support/ticket-types';
import { resolveWorkspaceConfig } from '@/lib/workspace-config';
import { resolveIndustrySelection } from '@/lib/industry-aliases';
import { MEDICAL_EQUIPMENT_PACK } from '@/lib/industry-packs/medical-equipment';

describe('industry vertical packs', () => {
  it('registers wave A + wave B packs', () => {
    const ids = listIndustryVerticalPacks().map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'medical_equipment',
        'manufacturing',
        'facilities_management',
        'logistics',
        'automotive',
        'pharma',
        'fmcg',
      ])
    );
  });

  it('medical pack includes Graphoid-parity ticket categories and 4h critical SLA', () => {
    const pack = getIndustryVerticalPack('medical_equipment')!;
    const ids = pack.ticketTypes.map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'device_breakdown',
        'preventive_maintenance',
        'calibration',
        'amc_service_visit',
      ])
    );
    expect(pack.slaByPriority.CRITICAL.responseHours).toBe(4);
    expect(pack.homeWidgets).toContain('renewals');
  });

  it('medical PM automation is enabled by default', () => {
    const pm = MEDICAL_EQUIPMENT_PACK.automations?.find(
      (a) => a.kind === 'pm_due_create_ticket'
    );
    expect(pm?.enabled).toBe(true);
  });

  it('resolveWorkspaceConfig merges pack features and homeWidgets', () => {
    const config = resolveWorkspaceConfig({
      businessVertical: 'manufacturing',
      industryAlias: 'manufacturing',
    });
    expect(config.features.fieldService).toBe(true);
    expect(config.homeWidgets).toContain('low_stock');
    expect(config.verticalLabel).toBe('Manufacturing');
  });

  it('ticket presets for logistics come from pack', () => {
    const types = getDefaultTicketTypesForVertical('manufacturing', 'logistics');
    const ids = types.map((t) => t.id);
    expect(ids).toContain('vehicle_breakdown');
    expect(ids).toContain('delivery');
    expect(ids).toContain('driver_incident');
  });

  it('facilities pack seeds housekeeping and MEP types', () => {
    const types = getDefaultTicketTypesForVertical('field_service', 'facilities_management');
    const ids = types.map((t) => t.id);
    expect(ids).toContain('housekeeping');
    expect(ids).toContain('mep');
    expect(ids).toContain('work_order');
  });

  it('wave B: automotive / pharma / fmcg ticket presets', () => {
    expect(
      getDefaultTicketTypesForVertical('field_service', 'automotive').map((t) => t.id)
    ).toEqual(expect.arrayContaining(['service_job', 'body_paint']));
    expect(
      getDefaultTicketTypesForVertical('manufacturing', 'pharma').map((t) => t.id)
    ).toEqual(expect.arrayContaining(['cold_chain', 'batch_issue']));
    expect(
      getDefaultTicketTypesForVertical('ecommerce', 'fmcg').map((t) => t.id)
    ).toEqual(expect.arrayContaining(['order_issue', 'scheme_query']));
  });

  it('industry selection still resolves medical alias to field_service', () => {
    const resolved = resolveIndustrySelection('medical_equipment');
    expect(resolved.businessVertical).toBe('field_service');
    expect(resolved.terminologyOverrides?.agent).toMatch(/Biomed/i);
  });
});
