import { ALL_PIPELINE_KINDS, PIPELINE_DEFS } from './defaults';
import type {
  CompanyPipelines,
  PipelineConfig,
  PipelineKind,
  PipelineStageDef,
} from './types';

function allowedIds(kind: PipelineKind): Set<string> {
  return new Set(PIPELINE_DEFS[kind].map((s) => s.id));
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
    if (!Array.isArray(stagesRaw)) continue;
    const allowed = allowedIds(kind);
    const stages = stagesRaw
      .map((s) => (typeof s === 'string' ? s.trim().toUpperCase() : ''))
      .filter((s) => s && allowed.has(s));
    // Preserve order, unique
    const seen = new Set<string>();
    const unique = stages.filter((s) => {
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });
    if (unique.length > 0) {
      defaults[kind] = { stages: unique };
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
    .map((id) => byId.get(id))
    .filter((d): d is PipelineStageDef => !!d);
}

export function isValidPipelineStage(
  kind: PipelineKind,
  stage: string,
  settings?: unknown
): boolean {
  const id = stage.trim().toUpperCase();
  if (!allowedIds(kind).has(id)) return false;
  if (settings === undefined) return true;
  return getPipelineConfig(kind, settings).stages.includes(id);
}

export function sanitizePipelinePatch(
  kind: PipelineKind,
  stages: unknown
): string[] | null {
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
  return out.length > 0 ? out : null;
}
