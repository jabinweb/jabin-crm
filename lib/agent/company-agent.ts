import { prisma } from '@/lib/prisma';
import {
  resolveModelFallbackChain,
  DEFAULT_MODEL_FALLBACKS,
  MIN_MODEL_CHAIN,
  MAX_MODEL_CHAIN,
} from '@/lib/agent/models';

export async function getOrCreateCompanyAgent(companyId: string) {
  const existing = await prisma.companyAgent.findUnique({
    where: { companyId },
  });
  if (existing) return existing;

  return prisma.companyAgent.create({
    data: {
      companyId,
      name: 'OPS',
      preferredModel: DEFAULT_MODEL_FALLBACKS[0],
      fallbackModels: [...DEFAULT_MODEL_FALLBACKS.slice(1, MIN_MODEL_CHAIN)],
      enabled: true,
    },
  });
}

export async function refreshCompanyAgentModels(params: {
  companyId: string;
  apiKey: string;
}) {
  const agent = await getOrCreateCompanyAgent(params.companyId);
  const { models, chain, listedLive } = await resolveModelFallbackChain({
    apiKey: params.apiKey,
    // Re-rank from live API each refresh so exhausted models aren't sticky
    preferredModel: null,
    storedFallbacks: [],
  });

  const trimmed = chain.slice(0, MAX_MODEL_CHAIN);
  const preferred = trimmed[0] || DEFAULT_MODEL_FALLBACKS[0];
  const fallbacks = trimmed.slice(1);

  while (fallbacks.length < MIN_MODEL_CHAIN - 1) {
    const next = DEFAULT_MODEL_FALLBACKS.find(
      (m) => m !== preferred && !fallbacks.includes(m)
    );
    if (!next) break;
    fallbacks.push(next);
  }

  const updated = await prisma.companyAgent.update({
    where: { id: agent.id },
    data: {
      preferredModel: preferred,
      fallbackModels: fallbacks,
    },
  });

  return {
    agent: updated,
    listedModels: models,
    chain: [preferred, ...fallbacks],
    listedLive,
  };
}
