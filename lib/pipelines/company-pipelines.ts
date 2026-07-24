import { ALL_PIPELINE_KINDS, PIPELINE_DEFS } from './defaults';
import type {
  CompanyPipelines,
  PipelineConfig,
  PipelineKind,
  PipelineStageDef,
} from './types';
import { UNMAPPED_STAGE_DEF, UNMAPPED_STAGE_ID } from './types';

function allowedIds(kind: PipelineKind): Set<string> {
  return new Set(PIPELINE_DEFS[kind].map((s) => s.id));
}

function sanitizeLabels(
  kind: PipelineKind,
  raw: unknown
): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const allowed = allowedIds(kind);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim().toUpperCase();
    if (!allowed.has(id) || typeof value !== 'string') continue;
    const label = value.trim();
    if (!label || label.length > 64) continue;
    out[id] = label;
  }
  return Object.keys(out).length ? out : undefined;
}

export function defaultPipelines(): CompanyPipelines {
  return ALL_PIPELINE_KINDS.reduce((acc, kind) => {
    acc[kind] = { stages: PIPELINE_DEFS[kind].map((s) => s.id) };
    return acc;
  }, {} as CompanyPipelines);
}

export function parsePipelines(settings: unknown): CompanyPipelines {
  const defaults = defaultPipelines();
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return defaults;
  }
  const raw = settings as Record<string, unknown>;
  const pipelinesRaw =
    raw.pipelines && typeof raw.pipelines === 'object' && !Array.isArray(raw.pipelines)
      ? (raw.pipelines as Record<string, unknown>)
      : {};

  for (const kind of ALL_PIPELINE_KINDS) {
    const entry = pipelinesRaw[kind];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const stagesRaw = (entry as { stages?: unknown }).stages;
    const labels = sanitizeLabels(kind, (entry as { labels?: unknown }).labels);
    if (!Array.isArray(stagesRaw)) {
      if (labels) defaults[kind] = { ...defaults[kind], labels };
      continue;
    }
    const allowed = allowedIds(kind);
    const stages = stagesRaw
      .map((s) => (typeof s === 'string' ? s.trim().toUpperCase() : ''))
      .filter((s) => s && allowed.has(s));
    const seen = new Set<string>();
    const unique = stages.filter((s) => {
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });
    if (unique.length > 0) {
      defaults[kind] = { stages: unique, ...(labels ? { labels } : {}) };
    } else if (labels) {
      defaults[kind] = { ...defaults[kind], labels };
    }
  }
  return defaults;
}

export function getPipelineConfig(
  kind: PipelineKind,
  settings: unknown
): PipelineConfig {
  return parsePipelines(settings)[kind];
}

export function resolvePipelineStages(
  kind: PipelineKind,
  settings: unknown
): PipelineStageDef[] {
  const config = getPipelineConfig(kind, settings);
  const defs = PIPELINE_DEFS[kind];
  const byId = new Map(defs.map((d) => [d.id, d]));
  return config.stages
    .map((id) => {
      const def = byId.get(id);
      if (!def) return undefined;
      const custom = config.labels?.[id];
      return custom ? { ...def, label: custom } : def;
    })
    .filter((d): d is PipelineStageDef => !!d);
}

/** Append Unmapped when any items fall outside configured columns. */
export function columnsWithUnmapped(
  columns: PipelineStageDef[],
  items: Array<{ stage: string }>
): PipelineStageDef[] {
  const configured = new Set(columns.map((c) => c.id));
  const needs = items.some(
    (i) => i.stage && i.stage !== UNMAPPED_STAGE_ID && !configured.has(i.stage)
  );
  if (!needs) return columns;
  return [...columns, UNMAPPED_STAGE_DEF];
}

export function isValidPipelineStage(
  kind: PipelineKind,
  stage: string,
  settings?: unknown
): boolean {
  const id = stage.trim().toUpperCase();
  if (id === UNMAPPED_STAGE_ID) return false;
  if (!allowedIds(kind).has(id)) return false;
  if (settings === undefined) return true;
  return getPipelineConfig(kind, settings).stages.includes(id);
}

export function sanitizePipelinePatch(
  kind: PipelineKind,
  stages: unknown,
  labels?: unknown
): { stages: string[]; labels?: Record<string, string> } | null {
  if (!Array.isArray(stages)) return null;
  const allowed = allowedIds(kind);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of stages) {
    if (typeof raw !== 'string') continue;
    const id = raw.trim().toUpperCase();
    if (!allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  if (out.length === 0) return null;
  const cleanedLabels = sanitizeLabels(kind, labels);
  return cleanedLabels ? { stages: out, labels: cleanedLabels } : { stages: out };
}

export { UNMAPPED_STAGE_ID, UNMAPPED_STAGE_DEF };
