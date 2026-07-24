import { prisma } from '@/lib/prisma';
import { resolveModelFallbackChain, DEFAULT_MODEL_FALLBACKS } from '@/lib/agent/models';

export async function getOrCreateCompanyAgent(companyId: string) {
  const existing = await prisma.companyAgent.findUnique({
    where: { companyId },
  });
  if (existing) return existing;

  return prisma.companyAgent.create({
    data: {
      companyId,
      name: 'Ops Agent',
      preferredModel: DEFAULT_MODEL_FALLBACKS[0],
      fallbackModels: [...DEFAULT_MODEL_FALLBACKS.slice(1)],
      enabled: true,
    },
  });
}

export async function refreshCompanyAgentModels(params: {
  companyId: string;
  apiKey: string;
}) {
  const agent = await getOrCreateCompanyAgent(params.companyId);
  const { models, chain } = await resolveModelFallbackChain({
    apiKey: params.apiKey,
    preferredModel: agent.preferredModel,
    storedFallbacks: Array.isArray(agent.fallbackModels)
      ? (agent.fallbackModels as string[])
      : [],
  });

  const preferred = chain[0] || DEFAULT_MODEL_FALLBACKS[0];
  const fallbacks = chain.slice(1);

  const updated = await prisma.companyAgent.update({
    where: { id: agent.id },
    data: {
      preferredModel: preferred,
      fallbackModels: fallbacks,
    },
  });

  return { agent: updated, listedModels: models, chain };
}
