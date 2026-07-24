import { listAvailableModels } from '@/lib/ai/ai-service';

/** Hardcoded preference order when live list is empty or incomplete. */
export const DEFAULT_MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-pro',
] as const;

export type ListedModel = { name: string; displayName: string; description: string };

/**
 * Fetch live Gemini models for this API key, then build an ordered fallback chain.
 * Preferred model (if set) is tried first; then live list ranked by DEFAULT order; then defaults.
 */
export async function resolveModelFallbackChain(params: {
  apiKey: string;
  preferredModel?: string | null;
  storedFallbacks?: string[] | null;
}): Promise<{ models: ListedModel[]; chain: string[] }> {
  let listed: ListedModel[] = [];
  try {
    listed = await listAvailableModels(params.apiKey);
  } catch {
    listed = [];
  }

  const liveNames = listed.map((m) => m.name);
  const liveSet = new Set(liveNames);

  const chain: string[] = [];
  const push = (id?: string | null) => {
    if (!id) return;
    const clean = id.replace(/^models\//, '').trim();
    if (!clean || chain.includes(clean)) return;
    chain.push(clean);
  };

  push(params.preferredModel);

  if (Array.isArray(params.storedFallbacks)) {
    for (const m of params.storedFallbacks) push(m);
  }

  // Prefer known-good order among live models
  for (const pref of DEFAULT_MODEL_FALLBACKS) {
    if (liveSet.has(pref) || liveSet.has(`models/${pref}`)) push(pref);
  }

  // Then any other live generative models
  for (const name of liveNames) push(name);

  // Finally static defaults if list failed
  if (chain.length === 0) {
    for (const pref of DEFAULT_MODEL_FALLBACKS) push(pref);
  }

  return { models: listed, chain };
}

export async function generateWithModelFallback<T>(params: {
  apiKey: string;
  chain: string[];
  run: (model: string) => Promise<T>;
}): Promise<{ result: T; modelUsed: string; attempted: string[] }> {
  const attempted: string[] = [];
  let lastError: unknown;

  for (const model of params.chain) {
    attempted.push(model);
    try {
      const result = await params.run(model);
      return { result, modelUsed: model, attempted };
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      // Try next on model-not-found / quota / unavailable
      if (
        /not found|NOT_FOUND|404|unavailable|RESOURCE_EXHAUSTED|429|quota|overloaded/i.test(
          msg
        )
      ) {
        continue;
      }
      // Other errors (bad request content) — still try next once or two
      if (attempted.length < 3) continue;
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('All Gemini models in fallback chain failed');
}
