import type { McpToolDescriptor } from '@/lib/mcp/tool-filter';

/**
 * Minimal, stateless MCP server core (JSON-RPC 2.0 over Streamable HTTP, JSON responses
 * only — no SSE stream, no sessions). Implements: initialize, notifications/initialized,
 * ping, tools/list, tools/call. Everything workspace-specific is injected, so this file
 * has no Prisma / tool-registry imports and is unit-tested directly.
 */
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = [
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
] as const;
export const MCP_LATEST_PROTOCOL_VERSION = MCP_SUPPORTED_PROTOCOL_VERSIONS[0];

export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

type JsonRpcId = string | number;

export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId | null; result: unknown }
  | { jsonrpc: '2.0'; id: JsonRpcId | null; error: { code: number; message: string; data?: unknown } };

export type McpToolCallResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export type McpServerDeps = {
  serverName: string;
  serverVersion: string;
  instructions?: string;
  listTools: () => Promise<McpToolDescriptor[]>;
  /** Runs an allowed tool. Throw `McpToolNotFoundError` for unknown / not-allowed names. */
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
};

export class McpToolNotFoundError extends Error {
  constructor(name: string) {
    super(`Unknown tool: ${name}`);
    this.name = 'McpToolNotFoundError';
  }
}

/** Keeps a single tool result from flooding the client's context window. */
export const MAX_TOOL_RESULT_CHARS = 100_000;

export function serializeToolResult(value: unknown): string {
  let text: string;
  if (typeof value === 'string') {
    text = value;
  } else {
    try {
      text =
        JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v), 2) ?? 'null';
    } catch {
      text = String(value);
    }
  }
  if (text.length > MAX_TOOL_RESULT_CHARS) {
    text = `${text.slice(0, MAX_TOOL_RESULT_CHARS)}\n…[truncated — narrow the query (filters / limit) to see more]`;
  }
  return text;
}

function ok(id: JsonRpcId | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function fail(id: JsonRpcId | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function isValidId(id: unknown): id is JsonRpcId {
  return typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id));
}

export function negotiateProtocolVersion(requested: unknown): string {
  return typeof requested === 'string' &&
    (MCP_SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : MCP_LATEST_PROTOCOL_VERSION;
}

/**
 * Handles one JSON-RPC message. Returns null for notifications and client responses
 * (nothing to send back).
 */
export async function handleMcpMessage(
  message: unknown,
  deps: McpServerDeps
): Promise<JsonRpcResponse | null> {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return fail(null, JSON_RPC_ERRORS.INVALID_REQUEST, 'Invalid request');
  }
  const msg = message as Record<string, unknown>;
  const hasId = 'id' in msg && msg.id !== undefined;

  // A response from the client (we never send requests) — ignore
  if (!('method' in msg) && ('result' in msg || 'error' in msg)) return null;

  if (msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return fail(isValidId(msg.id) ? msg.id : null, JSON_RPC_ERRORS.INVALID_REQUEST, 'Invalid request');
  }
  const method = msg.method;

  // Notifications get no response
  if (!hasId) return null;
  if (!isValidId(msg.id)) {
    return fail(null, JSON_RPC_ERRORS.INVALID_REQUEST, 'Invalid request id');
  }
  const id = msg.id;
  const params =
    msg.params && typeof msg.params === 'object' && !Array.isArray(msg.params)
      ? (msg.params as Record<string, unknown>)
      : {};

  try {
    switch (method) {
      case 'initialize':
        return ok(id, {
          protocolVersion: negotiateProtocolVersion(params.protocolVersion),
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: deps.serverName, version: deps.serverVersion },
          ...(deps.instructions ? { instructions: deps.instructions } : {}),
        });

      case 'ping':
        return ok(id, {});

      case 'tools/list':
        return ok(id, { tools: await deps.listTools() });

      case 'tools/call': {
        const name = params.name;
        if (typeof name !== 'string' || !name) {
          return fail(id, JSON_RPC_ERRORS.INVALID_PARAMS, 'params.name is required');
        }
        const rawArgs = params.arguments;
        if (rawArgs !== undefined && (typeof rawArgs !== 'object' || rawArgs === null || Array.isArray(rawArgs))) {
          return fail(id, JSON_RPC_ERRORS.INVALID_PARAMS, 'params.arguments must be an object');
        }
        const args = (rawArgs ?? {}) as Record<string, unknown>;
        try {
          const value = await deps.callTool(name, args);
          const result: McpToolCallResult = {
            content: [{ type: 'text', text: serializeToolResult(value) }],
          };
          return ok(id, result);
        } catch (error) {
          if (error instanceof McpToolNotFoundError) {
            return fail(id, JSON_RPC_ERRORS.INVALID_PARAMS, error.message);
          }
          // Tool failures are results the model can read and react to, not protocol errors
          const text = error instanceof Error && error.message ? error.message : 'Tool failed';
          const result: McpToolCallResult = { content: [{ type: 'text', text }], isError: true };
          return ok(id, result);
        }
      }

      // Not offered; answer politely so clients that probe them don't error out
      case 'resources/list':
        return ok(id, { resources: [] });
      case 'resources/templates/list':
        return ok(id, { resourceTemplates: [] });
      case 'prompts/list':
        return ok(id, { prompts: [] });

      default:
        return fail(id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  } catch (error) {
    console.error('[mcp]', method, error);
    return fail(id, JSON_RPC_ERRORS.INTERNAL_ERROR, 'Internal error');
  }
}

/**
 * Handles a POST body: one message or (2025-03-26 clients) a batch. Returns null when
 * nothing needs a response (notifications only → HTTP 202).
 */
export async function handleMcpPayload(
  payload: unknown,
  deps: McpServerDeps
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return fail(null, JSON_RPC_ERRORS.INVALID_REQUEST, 'Empty batch');
    }
    const responses: JsonRpcResponse[] = [];
    for (const message of payload.slice(0, 50)) {
      const response = await handleMcpMessage(message, deps);
      if (response) responses.push(response);
    }
    return responses.length ? responses : null;
  }
  return handleMcpMessage(payload, deps);
}
