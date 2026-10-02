import { describe, expect, it } from '@jest/globals';
import {
  generateContentWithFallback,
  isRetiredModel,
  textModelChain,
  TEXT_MODEL_FALLBACKS,
} from '@/lib/ai/generate';

type Behaviour = Record<string, Error | string>;

/** Minimal stand-in for GoogleGenAI: each model either throws or answers with text. */
function fakeClient(behaviour: Behaviour, calls: string[] = []) {
  return {
    models: {
      generateContent: async ({ model }: { model: string }) => {
        calls.push(model);
        const outcome = behaviour[model];
        if (outcome instanceof Error) throw outcome;
        return { text: outcome ?? 'ok', functionCalls: undefined };
      },
    },
  } as any;
}

function apiError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

describe('textModelChain', () => {
  it('puts the preferred model first and skips retired ones', () => {
    expect(textModelChain('gemini-2.5-pro')[0]).toBe('gemini-2.5-pro');
    expect(textModelChain('gemini-2.0-flash')).toEqual([...TEXT_MODEL_FALLBACKS]);
    expect(textModelChain('models/gemini-1.5-flash')).toEqual([...TEXT_MODEL_FALLBACKS]);
  });

  it('recognises retired families only', () => {
    expect(isRetiredModel('gemini-2.0-flash-exp')).toBe(true);
    expect(isRetiredModel('gemini-1.5-pro')).toBe(true);
    expect(isRetiredModel('gemini-2.5-flash')).toBe(false);
    expect(isRetiredModel('gemini-3.5-flash-lite')).toBe(false);
  });
});

describe('generateContentWithFallback', () => {
  it('falls through retired, rate-limited and empty models to one that answers', async () => {
    const calls: string[] = [];
    const client = fakeClient(
      {
        'gemini-3.8-flash': apiError(404, 'This model models/gemini-3.8-flash is no longer available.'),
        'gemini-3.7-flash': apiError(429, 'RESOURCE_EXHAUSTED: quota exceeded'),
        'gemini-3.6-flash': '',
        'gemini-3.5-flash': 'answer',
      },
      calls
    );

    const res = await generateContentWithFallback(client, { model: 'gemini-2.0-flash', contents: 'hi' });

    expect(res.text).toBe('answer');
    expect(res.modelUsed).toBe('gemini-3.5-flash');
    expect(calls).toEqual(['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash']);
  });

  it('does not retry on an invalid API key', async () => {
    const calls: string[] = [];
    const client = fakeClient({ 'gemini-3.8-flash': apiError(401, 'API key not valid') }, calls);

    await expect(
      generateContentWithFallback(client, { model: 'gemini-3.8-flash', contents: 'hi' })
    ).rejects.toThrow('API key not valid');
    expect(calls).toEqual(['gemini-3.8-flash']);
  });

  it('throws the last error when every model fails', async () => {
    const all: Behaviour = {};
    for (const m of TEXT_MODEL_FALLBACKS) all[m] = apiError(503, 'UNAVAILABLE: overloaded');
    await expect(
      generateContentWithFallback(fakeClient(all), { model: undefined as any, contents: 'hi' })
    ).rejects.toThrow('overloaded');
  });
});
