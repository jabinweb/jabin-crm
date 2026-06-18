import {
  findTicketTypeDefinition,
  getDefaultTicketTypesForVertical,
  resolvePortalTicketTypes,
  validateCustomFields,
} from '@/lib/support/ticket-types';
import { resolveWorkspaceConfig } from '@/lib/workspace-config';

describe('ticket-types', () => {
  it('includes base categories for general business', () => {
    const types = getDefaultTicketTypesForVertical('general');
    const ids = types.map((t) => t.id);
    expect(ids).toContain('general');
    expect(ids).toContain('technical');
    expect(ids).toContain('billing');
    expect(ids).not.toContain('equipment');
  });

  it('adds equipment types for field service when feature enabled', () => {
    const config = resolveWorkspaceConfig({ businessVertical: 'field_service' });
    const types = resolvePortalTicketTypes(config);
    expect(types.some((t) => t.id === 'equipment' && t.showEquipment)).toBe(true);
  });

  it('hides equipment types when equipment feature disabled', () => {
    const config = resolveWorkspaceConfig({
      businessVertical: 'field_service',
      featureOverrides: { equipment: false },
    });
    const types = resolvePortalTicketTypes(config);
    const equipmentType = types.find((t) => t.id === 'equipment');
    expect(equipmentType?.showEquipment).toBe(false);
  });

  it('validates required custom fields', () => {
    const type = findTicketTypeDefinition(
      getDefaultTicketTypesForVertical('ecommerce'),
      'order'
    );
    expect(type).toBeDefined();
    expect(validateCustomFields(type!, {})).toMatch(/required/i);
    expect(validateCustomFields(type!, { orderNumber: 'ORD-1' })).toBeNull();
  });
});
