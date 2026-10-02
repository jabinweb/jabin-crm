import type { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { logWarning } from '@/lib/logger';

/** Default text model for new profiles and for callers with no preference. */
export const DEFAULT_TEXT_MODEL = 'gemini-3.8-flash';

/**
 * Text models tried in order when the preferred one fails. Newest Flash models first,
 * then the Flash-Lite models with the largest free-tier daily quotas as a safety net.
 */
export const TEXT_MODEL_FALLBACKS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
] as const;

/** Model families Google has shut down — skipped even when stored as a user preference. */
export function isRetiredModel(model: string) {
  return /^(models\/)?gemini-(1\.0|1\.5|2\.0)(-|$)/i.test(model.trim());
}

/** Ordered, de-duplicated chain: the preferred model (unless retired), then the fallbacks. */
export function textModelChain(preferred?: string | null): string[] {
  const chain: string[] = [];
  const clean = preferred?.replace(/^models\//, '').trim();
  if (clean && !isRetiredModel(clean)) chain.push(clean);
  for (const model of TEXT_MODEL_FALLBACKS) {
    if (!chain.includes(model)) chain.push(model);
  }
  return chain;
}

/** Errors another model can fix: gone, rate-limited, overloaded, timed out or empty. */
function shouldTryNextModel(error: unknown) {
  const status = (error as { status?: number })?.status;
  if (typeof status === 'number') {
    if (status === 404 || status === 408 || status === 429 || status >= 500) return true;
    if (status === 400 || status === 401 || status === 403) return /not (found|supported)/i.test(String(error));
  }
  const msg = error instanceof Error ? error.message : String(error);
  return /not found|NOT_FOUND|no longer available|not supported|RESOURCE_EXHAUSTED|quota|rate limit|429|overloaded|UNAVAILABLE|503|500|INTERNAL|DEADLINE|timed out|empty response/i.test(
    msg
  );
}

class ModelTimeoutError extends Error {
  constructor(model: string, ms: number) {
    super(`${model} timed out after ${ms} ms`);
    this.name = 'ModelTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, model: string, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new ModelTimeoutError(model, ms)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * `client.models.generateContent` with automatic model fallback.
 *
 * `params.model` is treated as the preferred model. On a retired model, rate limit,
 * overload, timeout or empty reply the next model in {@link TEXT_MODEL_FALLBACKS} is
 * tried; auth and bad-request errors are thrown immediately. Stops once `budgetMs`
 * has elapsed so the request finishes inside the route's time limit.
 */
export async function generateContentWithFallback(
  client: GoogleGenAI,
  params: GenerateContentParameters,
  options: { attemptTimeoutMs?: number; budgetMs?: number; fallbacks?: readonly string[] } = {}
): Promise<GenerateContentResponse & { modelUsed: string }> {
  const attemptTimeoutMs = options.attemptTimeoutMs ?? 30_000;
  const budgetMs = options.budgetMs ?? 55_000;
  const chain = options.fallbacks
    ? [params.model, ...options.fallbacks].filter(
        (m, i, all): m is string => !!m && !isRetiredModel(m) && all.indexOf(m) === i
      )
    : textModelChain(params.model);

  const started = Date.now();
  let lastError: unknown;
  for (const model of chain) {
    const remaining = budgetMs - (Date.now() - started);
    if (remaining <= 1_000) break;
    try {
      const response = await withTimeout(
        client.models.generateContent({ ...params, model }),
        model,
        Math.min(attemptTimeoutMs, remaining)
      );
      if (!response.text?.trim() && !response.functionCalls?.length) {
        throw new Error(`${model} returned an empty response`);
      }
      return Object.assign(response, { modelUsed: model });
    } catch (error) {
      lastError = error;
      if (!shouldTryNextModel(error)) throw error;
      logWarning('Gemini model failed, trying the next one', {
        model,
        error: (error instanceof Error ? error.message : String(error)).slice(0, 300),
      });
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All Gemini models failed');
}
