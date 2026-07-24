export type PipelineKind =
  | 'leads'
  | 'deals'
  | 'tickets'
  | 'purchase_orders'
  | 'sales_orders';

export type PipelineStageDef = {
  id: string;
  label: string;
  color: string;
};

/** Display-only column for records whose status is not in the configured subset. */
export const UNMAPPED_STAGE_ID = '__UNMAPPED__';

export const UNMAPPED_STAGE_DEF: PipelineStageDef = {
  id: UNMAPPED_STAGE_ID,
  label: 'Unmapped',
  color: 'bg-zinc-400',
};

export type PipelineConfig = {
  stages: string[];
  /** Optional display label overrides keyed by enum stage id */
  labels?: Record<string, string>;
};

export type CompanyPipelines = Record<PipelineKind, PipelineConfig>;
