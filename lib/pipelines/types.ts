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

export type PipelineConfig = {
  stages: string[];
};

export type CompanyPipelines = Record<PipelineKind, PipelineConfig>;
