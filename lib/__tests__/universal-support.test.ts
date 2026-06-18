import {
  getDefaultTicketTypesForVertical,
  parseSupportSettings,
  resolvePortalTicketTypes,
} from '@/lib/support/ticket-types';
import { resolveWorkspaceConfig } from '@/lib/workspace-config';
import { getNextAvailableAgent } from '@/lib/support/ticket-assignment';
import { getStatusPipelineForTicketType, isValidStatusTransition } from '@/lib/support/status-pipelines';
import { getSlaConfigForTicket } from '@/lib/crm/sla-policies';

describe('universal support platform', () => {
  it('merges custom ticket types with presets', () => {
    const config = resolveWorkspaceConfig({ businessVertical: 'general' });
    const types = resolvePortalTicketTypes(config, {
      customTicketTypes: [
        {
          id: 'partnership',
          label: 'Partnership',
          description: 'Partner inquiries',
          defaultPriority: 'LOW',
          fields: [],
        },
      ],
    });
    expect(types.some((t) => t.id === 'partnership')).toBe(true);
    expect(types.some((t) => t.id === 'general')).toBe(true);
  });

  it('uses ticket-type SLA override when configured', async () => {
    const sla = await getSlaConfigForTicket({
      priority: 'MEDIUM',
      ticketType: 'billing',
      supportSettings: {
        slaByTicketType: {
          billing: { responseHours: 1, resolutionHours: 12 },
        },
      },
    });
    expect(sla.responseHours).toBe(1);
    expect(sla.resolutionHours).toBe(12);
  });

  it('validates status pipeline transitions', () => {
    const pipeline = getStatusPipelineForTicketType('billing', {
      statusPipelines: {
        billing: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      },
    });
    expect(isValidStatusTransition('OPEN', 'IN_PROGRESS', pipeline)).toBe(true);
    expect(isValidStatusTransition('RESOLVED', 'OPEN', pipeline)).toBe(false);
  });

  it('seeds group names from vertical ticket types', () => {
    const types = getDefaultTicketTypesForVertical('ecommerce');
    const groups = new Set(types.map((t) => t.groupName).filter(Boolean));
    expect(groups.has('Orders')).toBe(true);
  });
});
