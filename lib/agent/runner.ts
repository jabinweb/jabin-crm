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

type ModelPart = {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: { name?: string; args?: Record<string, unknown> };
  functionResponse?: unknown;
  inlineData?: { mimeType: string; data: string };
};

type ModelContent = { role: string; parts: ModelPart[] };

export type AgentImageAttachment = {
  mimeType: string;
  /** Public URL (preferred for persistence) */
  url?: string;
  /** Raw base64 without data: prefix (for immediate vision; optional persist) */
  data?: string;
};

/** Return the model content exactly as Gemini sent it (keeps thoughtSignature). */
function getModelContent(response: {
  candidates?: Array<{ content?: { role?: string; parts?: ModelPart[] } }>;
}): ModelContent | null {
  const content = response.candidates?.[0]?.content;
  if (!content?.parts?.length) return null;
  return {
    role: content.role || 'model',
    // Clone parts so we never mutate the SDK response object
    parts: content.parts.map((p) => ({ ...p })),
  };
}

function extractFunctionCalls(response: {
  functionCalls?: Array<{ name?: string; args?: Record<string, unknown> }>;
  candidates?: Array<{ content?: { parts?: ModelPart[] } }>;
}): Array<{ name: string; args: Record<string, unknown> }> {
  const parts = response.candidates?.[0]?.content?.parts || [];
  const fromParts: Array<{ name: string; args: Record<string, unknown> }> = [];
  for (const part of parts) {
    if (part.functionCall?.name) {
      fromParts.push({
        name: part.functionCall.name,
        args: (part.functionCall.args || {}) as Record<string, unknown>,
      });
    }
  }
  if (fromParts.length) return fromParts;

  if (Array.isArray(response.functionCalls) && response.functionCalls.length) {
    return response.functionCalls
      .filter((f) => f.name)
      .map((f) => ({
        name: f.name!,
        args: (f.args || {}) as Record<string, unknown>,
      }));
  }
  return [];
}

/**
 * Gemini 3.x requires thoughtSignature on functionCall parts when echoing
 * history. Prefer the raw model content; otherwise attach the skip token.
 */
function modelTurnWithFunctionCalls(
  response: {
    candidates?: Array<{ content?: { role?: string; parts?: ModelPart[] } }>;
  },
  calls: Array<{ name: string; args: Record<string, unknown> }>
): ModelContent {
  const original = getModelContent(response);
  if (original) {
    const hasFc = original.parts.some((p) => p.functionCall?.name);
    if (hasFc) return original;
  }

  return {
    role: 'model',
    parts: calls.map((c, index) => ({
      functionCall: { name: c.name, args: c.args },
      ...(index === 0
        ? { thoughtSignature: 'skip_thought_signature_validator' }
        : {}),
    })),
  };
}

async function resolveInlineImage(
  image: AgentImageAttachment
): Promise<{ mimeType: string; data: string } | null> {
  const mimeType = (image.mimeType || 'image/png').split(';')[0].trim();
  if (image.data) {
    const data = image.data.replace(/^data:[^;]+;base64,/, '');
    if (data) return { mimeType, data };
  }
  if (!image.url) return null;
  try {
    const res = await fetch(image.url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Cap ~4MB decoded
    if (buf.byteLength > 4 * 1024 * 1024) return null;
    return { mimeType, data: buf.toString('base64') };
  } catch {
    return null;
  }
}

async function buildUserParts(
  text: string,
  images?: AgentImageAttachment[] | null
): Promise<ModelPart[]> {
  const parts: ModelPart[] = [];
  if (text.trim()) parts.push({ text: text.trim() });
  if (images?.length) {
    for (const img of images.slice(0, 4)) {
      const inline = await resolveInlineImage(img);
      if (inline) parts.push({ inlineData: inline });
    }
  }
  if (!parts.length) parts.push({ text: '(screenshot attached)' });
  return parts;
}

export async function runAgentTurn(params: {
  companyId: string;
  userId: string;
  userRole: string;
  userName?: string | null;
  threadId?: string | null;
  message: string;
  images?: AgentImageAttachment[] | null;
}): Promise<AgentTurnResult> {
  const apiKey = await resolveApiKey(params.userId);
  const agent = await getOrCreateCompanyAgent(params.companyId);
  if (!agent.enabled) throw new Error('OPS is disabled for this company');

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

  const images = (params.images || [])
    .filter((img) => img && (img.url || img.data))
    .slice(0, 4);

  let threadId = params.threadId || null;
  if (threadId) {
    const existing = await prisma.agentThread.findFirst({
      where: { id: threadId, companyId: params.companyId, userId: params.userId },
    });
    if (!existing) threadId = null;
  }
  if (!threadId) {
    const titleBase =
      params.message.trim() ||
      (images.length ? 'Screenshot analysis' : 'New chat');
    const thread = await prisma.agentThread.create({
      data: {
        companyId: params.companyId,
        agentId: agent.id,
        userId: params.userId,
        title: titleBase.slice(0, 80),
      },
    });
    threadId = thread.id;
  }

  // Persist a marker only — screenshot bytes stay on the user's device / this request
  await prisma.agentMessage.create({
    data: {
      threadId,
      role: 'user',
      content: {
        text: params.message,
        localScreenshot: images.length > 0,
        screenshotCount: images.length || undefined,
      },
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

  type ContentPart = ModelPart;
  type Content = ModelContent;

  const contents: Content[] = [];
  for (let hi = 0; hi < history.length; hi++) {
    const msg = history[hi];
    const c = msg.content as {
      text?: string;
      localScreenshot?: boolean;
    };
    if (msg.role === 'user') {
      const isLatest = hi === history.length - 1;
      // Vision bytes only for the current turn (local device → this request)
      contents.push({
        role: 'user',
        parts: await buildUserParts(
          c.text || '',
          isLatest ? images : null
        ),
      });
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

    // Echo the model turn verbatim so thoughtSignature stays on functionCall parts
    contents.push(modelTurnWithFunctionCalls(response as never, calls));

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
