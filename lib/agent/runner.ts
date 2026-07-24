import { getAIClient } from '@/lib/ai/ai-service';
import { generateWithModelFallback } from '@/lib/agent/models';
import {
  buildAgentContext,
  buildSystemPrompt,
  type AgentRuntimeContext,
} from '@/lib/agent/context';
import {
  getToolByName,
  getToolsForRole,
  toGeminiFunctionDeclarations,
} from '@/lib/agent/tools';
import { getOrCreateCompanyAgent, refreshCompanyAgentModels } from '@/lib/agent/company-agent';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export type PendingWrite = {
  toolRunId: string;
  toolName: string;
  args: Record<string, unknown>;
  description: string;
};

export type AgentTurnResult = {
  threadId: string;
  reply: string;
  modelUsed: string;
  pendingWrites: PendingWrite[];
  toolTrace: Array<{ name: string; kind: string; status: string }>;
};

async function resolveApiKey(userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { geminiApiKey: true },
  });
  if (profile?.geminiApiKey) {
    try {
      return decrypt(profile.geminiApiKey);
    } catch {
      /* fall through */
    }
  }
  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (!envKey) throw new Error('No Gemini API key. Set one in Settings → API keys.');
  return envKey;
}

function extractText(response: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  text?: string;
}): string {
  if (typeof response.text === 'string' && response.text) return response.text;
  const parts = response.candidates?.[0]?.content?.parts || [];
  return parts
    .map((p) => p.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

function extractFunctionCalls(response: {
  functionCalls?: Array<{ name?: string; args?: Record<string, unknown> }>;
  candidates?: Array<{
    content?: {
      parts?: Array<{
        functionCall?: { name?: string; args?: Record<string, unknown> };
      }>;
    };
  }>;
}): Array<{ name: string; args: Record<string, unknown> }> {
  if (Array.isArray(response.functionCalls) && response.functionCalls.length) {
    return response.functionCalls
      .filter((f) => f.name)
      .map((f) => ({ name: f.name!, args: (f.args || {}) as Record<string, unknown> }));
  }
  const parts = response.candidates?.[0]?.content?.parts || [];
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  for (const part of parts) {
    if (part.functionCall?.name) {
      calls.push({
        name: part.functionCall.name,
        args: (part.functionCall.args || {}) as Record<string, unknown>,
      });
    }
  }
  return calls;
}

export async function runAgentTurn(params: {
  companyId: string;
  userId: string;
  userRole: string;
  userName?: string | null;
  threadId?: string | null;
  message: string;
}): Promise<AgentTurnResult> {
  const apiKey = await resolveApiKey(params.userId);
  const agent = await getOrCreateCompanyAgent(params.companyId);
  if (!agent.enabled) throw new Error('Ops Agent is disabled for this company');

  const { chain } = await refreshCompanyAgentModels({
    companyId: params.companyId,
    apiKey,
  });

  const ctx = await buildAgentContext({
    companyId: params.companyId,
    userId: params.userId,
    userRole: params.userRole,
    userName: params.userName,
  });

  let threadId = params.threadId || null;
  if (threadId) {
    const existing = await prisma.agentThread.findFirst({
      where: { id: threadId, companyId: params.companyId, userId: params.userId },
    });
    if (!existing) threadId = null;
  }
  if (!threadId) {
    const thread = await prisma.agentThread.create({
      data: {
        companyId: params.companyId,
        agentId: agent.id,
        userId: params.userId,
        title: params.message.slice(0, 80),
      },
    });
    threadId = thread.id;
  }

  await prisma.agentMessage.create({
    data: {
      threadId,
      role: 'user',
      content: { text: params.message },
    },
  });

  const history = await prisma.agentMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: 'asc' },
    take: 40,
  });

  const tools = getToolsForRole(params.userRole);
  const declarations = toGeminiFunctionDeclarations(tools);
  const systemPrompt = buildSystemPrompt(ctx, agent.systemPromptExtra);

  type ContentPart = { text?: string; functionCall?: unknown; functionResponse?: unknown };
  type Content = { role: string; parts: ContentPart[] };

  const contents: Content[] = [];
  for (const msg of history) {
    const c = msg.content as { text?: string };
    if (msg.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: c.text || '' }] });
    } else if (msg.role === 'assistant' && c.text) {
      contents.push({ role: 'model', parts: [{ text: c.text }] });
    }
  }

  const client = getAIClient(apiKey);
  const pendingWrites: PendingWrite[] = [];
  const toolTrace: Array<{ name: string; kind: string; status: string }> = [];
  let finalReply = '';
  let modelUsed = chain[0];

  const maxLoops = 6;
  for (let i = 0; i < maxLoops; i++) {
    const { result: response, modelUsed: used } = await generateWithModelFallback({
      apiKey,
      chain,
      run: async (model) =>
        client.models.generateContent({
          model,
          contents: contents as never,
          config: {
            systemInstruction: systemPrompt,
            tools: [{ functionDeclarations: declarations as never }],
            temperature: 0.3,
          },
        }),
    });
    modelUsed = used;

    const calls = extractFunctionCalls(response as never);
    const text = extractText(response as never);

    if (!calls.length) {
      finalReply = text || 'Done.';
      break;
    }

    // Model asked for tools
    contents.push({
      role: 'model',
      parts: calls.map((c) => ({
        functionCall: { name: c.name, args: c.args },
      })),
    });

    const functionResponseParts: ContentPart[] = [];

    for (const call of calls) {
      const tool = getToolByName(call.name);
      if (!tool || !tools.some((t) => t.name === call.name)) {
        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: { error: 'Tool not allowed' },
          },
        });
        toolTrace.push({ name: call.name, kind: 'unknown', status: 'denied' });
        continue;
      }

      if (tool.kind === 'write') {
        const toolRun = await prisma.agentToolRun.create({
          data: {
            threadId: threadId!,
            toolName: tool.name,
            args: call.args as object,
            status: 'pending',
          },
        });
        pendingWrites.push({
          toolRunId: toolRun.id,
          toolName: tool.name,
          args: call.args,
          description: tool.description,
        });
        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: {
              status: 'pending_confirmation',
              toolRunId: toolRun.id,
              message:
                'Write action queued. Tell the user to confirm in the UI before it runs.',
            },
          },
        });
        toolTrace.push({ name: tool.name, kind: 'write', status: 'pending' });
        continue;
      }

      try {
        const result = await tool.execute(call.args, ctx, apiKey);
        await prisma.agentToolRun.create({
          data: {
            threadId: threadId!,
            toolName: tool.name,
            args: call.args as object,
            result: result as object,
            status: 'executed',
            executedAt: new Date(),
          },
        });
        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: result as object,
          },
        });
        toolTrace.push({ name: tool.name, kind: 'read', status: 'executed' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tool failed';
        await prisma.agentToolRun.create({
          data: {
            threadId: threadId!,
            toolName: tool.name,
            args: call.args as object,
            status: 'error',
            error: message,
          },
        });
        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: { error: message },
          },
        });
        toolTrace.push({ name: tool.name, kind: 'read', status: 'error' });
      }
    }

    contents.push({ role: 'user', parts: functionResponseParts });

    // If only pending writes and no more reads, ask model to summarize
    if (pendingWrites.length && calls.every((c) => getToolByName(c.name)?.kind === 'write')) {
      // one more loop to get natural language
      continue;
    }
  }

  if (!finalReply) {
    // Final pass without tools for summary
    try {
      const { result: response, modelUsed: used } = await generateWithModelFallback({
        apiKey,
        chain,
        run: async (model) =>
          client.models.generateContent({
            model,
            contents: [
              ...contents,
              {
                role: 'user',
                parts: [
                  {
                    text: 'Summarize what you found and any actions waiting for confirmation. Be concise.',
                  },
                ],
              },
            ] as never,
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.3,
            },
          }),
      });
      modelUsed = used;
      finalReply = extractText(response as never) || 'Actions are ready for confirmation.';
    } catch {
      finalReply =
        pendingWrites.length > 0
          ? 'I prepared actions that need your confirmation.'
          : 'I could not complete that request.';
    }
  }

  await prisma.agentMessage.create({
    data: {
      threadId: threadId!,
      role: 'assistant',
      content: {
        text: finalReply,
        pendingWrites,
        modelUsed,
        toolTrace,
      },
    },
  });

  await prisma.agentThread.update({
    where: { id: threadId! },
    data: { updatedAt: new Date() },
  });

  return {
    threadId: threadId!,
    reply: finalReply,
    modelUsed,
    pendingWrites,
    toolTrace,
  };
}

export async function confirmToolRun(params: {
  companyId: string;
  userId: string;
  userRole: string;
  userName?: string | null;
  toolRunId: string;
  action: 'confirm' | 'reject';
}) {
  const run = await prisma.agentToolRun.findFirst({
    where: {
      id: params.toolRunId,
      status: 'pending',
      thread: { companyId: params.companyId, userId: params.userId },
    },
    include: { thread: true },
  });
  if (!run) throw new Error('Pending tool run not found');

  if (params.action === 'reject') {
    await prisma.agentToolRun.update({
      where: { id: run.id },
      data: { status: 'rejected' },
    });
    return { status: 'rejected' as const };
  }

  const tool = getToolByName(run.toolName);
  if (!tool) throw new Error('Unknown tool');

  const tools = getToolsForRole(params.userRole);
  if (!tools.some((t) => t.name === tool.name)) {
    throw new Error('Not allowed to run this tool');
  }

  const apiKey = await resolveApiKey(params.userId);
  const ctx = await buildAgentContext({
    companyId: params.companyId,
    userId: params.userId,
    userRole: params.userRole,
    userName: params.userName,
  });

  try {
    const result = await tool.execute(
      run.args as Record<string, unknown>,
      ctx,
      apiKey
    );
    await prisma.agentToolRun.update({
      where: { id: run.id },
      data: {
        status: 'executed',
        result: result as object,
        executedAt: new Date(),
      },
    });
    await prisma.agentMessage.create({
      data: {
        threadId: run.threadId,
        role: 'assistant',
        content: {
          text: `Confirmed: ${tool.name} completed.`,
          toolResult: result,
        },
      },
    });
    return { status: 'executed' as const, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed';
    await prisma.agentToolRun.update({
      where: { id: run.id },
      data: { status: 'error', error: message },
    });
    throw error;
  }
}

export type { AgentRuntimeContext };
