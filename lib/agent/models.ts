/** Preference order for Ops Agent — Text-out models with better free-tier headroom first. */
export const DEFAULT_MODEL_FALLBACKS = [
  // Highest remaining quota on typical free tiers (Flash Lite / 3.x)
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3.1-pro-preview',
  'gemini-3-pro-preview',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-lite-001',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-pro-latest',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
] as const;

/** Preferred + fallbacks must cover at least this many models. */
export const MIN_MODEL_CHAIN = 5;

/** Cap how many we persist / try so turns stay bounded. */
export const MAX_MODEL_CHAIN = 10;

export type ListedModel = { name: string; displayName: string; description: string };

function cleanModelId(id?: string | null): string | null {
  if (!id) return null;
  const clean = id.replace(/^models\//, '').trim();
  return clean || null;
}

/** Drop Live API / agent / image-adjacent ids that may still slip through listing. */
function isAgentChatModel(id: string): boolean {
  const n = id.toLowerCase();
  if (!n.includes('gemini')) return false;
  const exclude = [
    'embedding',
    'image',
    'tts',
    'audio',
    'video',
    'robotics',
    'computer-use',
    'live',
    'omni',
    'dialog',
    'native-audio',
    'customtools',
  ];
  return !exclude.some((p) => n.includes(p));
}

async function defaultListModels(apiKey: string): Promise<ListedModel[]> {
  const { listAvailableModels } = await import('@/lib/ai/ai-service');
  return listAvailableModels(apiKey);
}

/**
 * Fetch live Gemini models via client.models.list(), then build an ordered
 * fallback chain of at least MIN_MODEL_CHAIN text-out chat models.
 *
 * Ranking: DEFAULT_MODEL_FALLBACKS ∩ live → other live chat models → static pad.
 * Sticky preferred (if still a valid chat model) is moved to front after ranking
 * so stale exhausted defaults don't permanently pin an old model.
 */
export async function resolveModelFallbackChain(params: {
  apiKey: string;
  preferredModel?: string | null;
  storedFallbacks?: string[] | null;
  /** Optional override for tests — defaults to Gemini `models.list()`. */
  listModels?: (apiKey: string) => Promise<ListedModel[]>;
}): Promise<{ models: ListedModel[]; chain: string[]; listedLive: boolean }> {
  const listFn = params.listModels ?? defaultListModels;

  let listed: ListedModel[] = [];
  let listedLive = false;
  try {
    listed = await listFn(params.apiKey);
    listedLive = listed.length > 0;
  } catch {
    listed = [];
    listedLive = false;
  }

  const liveNames = listed
    .map((m) => cleanModelId(m.name))
    .filter((n): n is string => !!n && isAgentChatModel(n));
  const liveSet = new Set(liveNames);

  const chain: string[] = [];
  const push = (id?: string | null) => {
    const clean = cleanModelId(id);
    if (!clean || !isAgentChatModel(clean) || chain.includes(clean)) return;
    if (chain.length >= MAX_MODEL_CHAIN) return;
    chain.push(clean);
  };

  // 1) Preferred defaults that exist in the live API list (quota-aware order)
  for (const pref of DEFAULT_MODEL_FALLBACKS) {
    if (liveSet.has(pref)) push(pref);
  }

  // 2) Any other live chat models not already ranked
  for (const name of liveNames) push(name);

  // 3) Previously stored fallbacks (only if still useful / live or known)
  if (Array.isArray(params.storedFallbacks)) {
    for (const m of params.storedFallbacks) {
      const clean = cleanModelId(m);
      if (clean && (liveSet.has(clean) || DEFAULT_MODEL_FALLBACKS.includes(clean as never))) {
        push(clean);
      }
    }
  }

  // Pad with static defaults so we always have ≥ MIN_MODEL_CHAIN
  for (const pref of DEFAULT_MODEL_FALLBACKS) {
    if (chain.length >= MIN_MODEL_CHAIN) break;
    push(pref);
  }
  for (const pref of DEFAULT_MODEL_FALLBACKS) {
    if (chain.length >= MAX_MODEL_CHAIN) break;
    push(pref);
  }

  // Optional sticky preferred only if caller wants it and it's still chat-capable.
  // Ops Agent refresh passes null so exhausted models are not permanently pinned.
  const preferred = cleanModelId(params.preferredModel);
  if (preferred && isAgentChatModel(preferred)) {
    const idx = chain.indexOf(preferred);
    if (idx > 0) {
      chain.splice(idx, 1);
      chain.unshift(preferred);
    } else if (idx < 0 && (liveSet.has(preferred) || DEFAULT_MODEL_FALLBACKS.includes(preferred as never))) {
      chain.unshift(preferred);
      while (chain.length > MAX_MODEL_CHAIN) chain.pop();
    }
  }

  return { models: listed, chain, listedLive };
}

export async function generateWithModelFallback<T>(params: {
  apiKey: string;
  chain: string[];
  run: (model: string) => Promise<T>;
}): Promise<{ result: T; modelUsed: string; attempted: string[] }> {
  const chain =
    params.chain.length >= MIN_MODEL_CHAIN
      ? params.chain
      : [
          ...params.chain,
          ...DEFAULT_MODEL_FALLBACKS.filter(
            (m) => isAgentChatModel(m) && !params.chain.includes(m)
          ),
        ].slice(0, MAX_MODEL_CHAIN);

  const attempted: string[] = [];
  let lastError: unknown;

  for (const model of chain) {
    attempted.push(model);
    try {
      const result = await params.run(model);
      return { result, modelUsed: model, attempted };
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      if (
        /not found|NOT_FOUND|404|unavailable|RESOURCE_EXHAUSTED|429|quota|overloaded/i.test(
          msg
        )
      ) {
        continue;
      }
      if (attempted.length < Math.min(chain.length, MIN_MODEL_CHAIN)) continue;
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('All Gemini models in fallback chain failed');
}
