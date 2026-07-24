import { describe, expect, it } from '@jest/globals';
import {
  UNMAPPED_STAGE_ID,
  columnsWithUnmapped,
  isValidPipelineStage,
  parsePipelines,
  resolvePipelineStages,
  sanitizePipelinePatch,
} from '@/lib/pipelines';

describe('company pipelines', () => {
  it('defaults to full enum order when settings are empty', () => {
    const stages = resolvePipelineStages('leads', undefined);
    expect(stages.map((s) => s.id)).toContain('NEW');
    expect(stages.map((s) => s.id)).toContain('WON');
  });

  it('hides disabled stages from resolved columns', () => {
    const settings = {
      pipelines: {
        tickets: { stages: ['OPEN', 'IN_PROGRESS', 'CLOSED'] },
      },
    };
    const columns = resolvePipelineStages('tickets', settings);
    expect(columns.map((c) => c.id)).toEqual(['OPEN', 'IN_PROGRESS', 'CLOSED']);
    expect(isValidPipelineStage('tickets', 'ASSIGNED', settings)).toBe(false);
    expect(isValidPipelineStage('tickets', 'OPEN', settings)).toBe(true);
  });

  it('applies custom display labels', () => {
    const settings = {
      pipelines: {
        deals: {
          stages: ['PROSPECTING', 'PROPOSAL'],
          labels: { PROSPECTING: 'New chase', PROPOSAL: 'Sent quote' },
        },
      },
    };
    const columns = resolvePipelineStages('deals', settings);
    expect(columns[0].label).toBe('New chase');
    expect(columns[1].label).toBe('Sent quote');
  });

  it('rejects empty or invalid stage patches', () => {
    expect(sanitizePipelinePatch('leads', [])).toBeNull();
    expect(sanitizePipelinePatch('leads', ['NOT_A_STATUS'])).toBeNull();
    expect(sanitizePipelinePatch('leads', ['NEW', 'CONTACTED'])?.stages).toEqual([
      'NEW',
      'CONTACTED',
    ]);
  });

  it('parses labels with stages', () => {
    const parsed = parsePipelines({
      pipelines: {
        sales_orders: {
          stages: ['PENDING', 'SHIPPED'],
          labels: { PENDING: 'Queued' },
        },
      },
    });
    expect(parsed.sales_orders.stages).toEqual(['PENDING', 'SHIPPED']);
    expect(parsed.sales_orders.labels?.PENDING).toBe('Queued');
  });
});

describe('board unmapped column', () => {
  it('appends Unmapped when items fall outside configured stages', () => {
    const base = resolvePipelineStages('purchase_orders', {
      pipelines: { purchase_orders: { stages: ['DRAFT', 'SENT'] } },
    });
    const withUnmapped = columnsWithUnmapped(base, [
      { stage: 'DRAFT' },
      { stage: 'CANCELLED' },
    ]);
    expect(withUnmapped.at(-1)?.id).toBe(UNMAPPED_STAGE_ID);
  });

  it('does not append Unmapped when all items fit', () => {
    const base = resolvePipelineStages('sales_orders', undefined);
    const cols = columnsWithUnmapped(base, [{ stage: 'PENDING' }]);
    expect(cols.some((c) => c.id === UNMAPPED_STAGE_ID)).toBe(false);
  });
});
