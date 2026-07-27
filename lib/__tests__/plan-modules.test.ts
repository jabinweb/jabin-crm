import { parsePlanModules } from '@/lib/plan-modules';

describe('parsePlanModules', () => {
  it('matches plan names case-insensitively so Starter keeps WhatsApp', () => {
    expect(parsePlanModules('starter', null).WHATSAPP).toBe(true);
    expect(parsePlanModules('Starter', null).WHATSAPP).toBe(true);
    expect(parsePlanModules('STARTER', null).WHATSAPP).toBe(true);
    expect(parsePlanModules('professional', null).WHATSAPP).toBe(true);
    expect(parsePlanModules('Professional', null).WHATSAPP).toBe(true);
  });

  it('keeps free without WhatsApp', () => {
    expect(parsePlanModules('free', null).WHATSAPP).toBe(false);
    expect(parsePlanModules('unknown-plan', null).WHATSAPP).toBe(false);
  });

  it('respects explicit module overrides in plan JSON', () => {
    expect(parsePlanModules('starter', { WHATSAPP: false }).WHATSAPP).toBe(false);
    expect(parsePlanModules('free', { WHATSAPP: true }).WHATSAPP).toBe(true);
  });
});
