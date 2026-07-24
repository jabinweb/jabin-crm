import { describe, expect, it } from '@jest/globals';
import {
  resolveModelFallbackChain,
  MIN_MODEL_CHAIN,
  DEFAULT_MODEL_FALLBACKS,
} from '@/lib/agent/models';

describe('resolveModelFallbackChain', () => {
  it('uses injected live list and builds a chain of at least 5', async () => {
    const listModels = async () => [
      { name: 'gemini-2.5-flash', displayName: '2.5 Flash', description: '' },
      { name: 'gemini-2.0-flash', displayName: '2.0 Flash', description: '' },
      { name: 'gemini-1.5-pro', displayName: '1.5 Pro', description: '' },
    ];

    const { chain, listedLive, models } = await resolveModelFallbackChain({
      apiKey: 'test-key',
      preferredModel: 'gemini-2.5-flash',
      listModels,
    });

    expect(listedLive).toBe(true);
    expect(models.length).toBe(3);
    expect(chain[0]).toBe('gemini-2.5-flash');
    expect(chain.length).toBeGreaterThanOrEqual(MIN_MODEL_CHAIN);
    expect(chain.length).toBeGreaterThanOrEqual(5);
  });

  it('pads to at least 5 when live list is empty', async () => {
    const { chain, listedLive } = await resolveModelFallbackChain({
      apiKey: 'test-key',
      listModels: async () => [],
    });

    expect(listedLive).toBe(false);
    expect(chain.length).toBeGreaterThanOrEqual(5);
    expect(chain.slice(0, 3)).toEqual([
      DEFAULT_MODEL_FALLBACKS[0],
      DEFAULT_MODEL_FALLBACKS[1],
      DEFAULT_MODEL_FALLBACKS[2],
    ]);
  });

  it('pads when list API throws', async () => {
    const { chain, listedLive } = await resolveModelFallbackChain({
      apiKey: 'test-key',
      listModels: async () => {
        throw new Error('network');
      },
    });

    expect(listedLive).toBe(false);
    expect(chain.length).toBeGreaterThanOrEqual(5);
  });

  it('ranks live 3.x Flash Lite ahead of 2.5 Flash when no preferred pin', async () => {
    const { chain } = await resolveModelFallbackChain({
      apiKey: 'test-key',
      preferredModel: null,
      listModels: async () => [
        { name: 'gemini-2.5-flash', displayName: '2.5 Flash', description: '' },
        { name: 'gemini-3.1-flash-lite', displayName: '3.1 Flash Lite', description: '' },
        { name: 'gemini-3.5-flash-lite', displayName: '3.5 Flash Lite', description: '' },
        { name: 'gemini-3.6-flash', displayName: '3.6 Flash', description: '' },
        { name: 'gemini-3.5-flash', displayName: '3.5 Flash', description: '' },
      ],
    });

    expect(chain[0]).toBe('gemini-3.1-flash-lite');
    expect(chain.slice(0, 5)).toEqual([
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
    ]);
  });
});
