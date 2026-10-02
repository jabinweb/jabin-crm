import {
  JSON_RPC_ERRORS,
  MAX_TOOL_RESULT_CHARS,
  McpToolNotFoundError,
  handleMcpMessage,
  handleMcpPayload,
  type McpServerDeps,
} from '@/lib/mcp/json-rpc';
import { toMcpToolDescriptor } from '@/lib/mcp/tool-filter';

function makeDeps(overrides: Partial<McpServerDeps> = {}): McpServerDeps {
  const tools = {
    search_customers: async (args: Record<string, unknown>) => ({
      customers: [{ id: 'c1', name: `Match for ${String(args.query)}` }],
    }),
    failing_tool: async () => {
      throw new Error('Customer not found');
    },
  } as Record<string, (args: Record<string, unknown>) => Promise<unknown>>;
  return {
    serverName: 'opslane',
    serverVersion: '1.0.0',
    instructions: 'Workspace runmora',
    listTools: async () =>
      Object.keys(tools).map((name) =>
        toMcpToolDescriptor({
          name,
          kind: 'read',
          description: name,
          parameters: { type: 'object', properties: {} },
        })
      ),
    callTool: async (name, args) => {
      const fn = tools[name];
      if (!fn) throw new McpToolNotFoundError(name);
      return fn(args);
    },
    ...overrides,
  };
}

const req = (id: number, method: string, params?: unknown) => ({ jsonrpc: '2.0', id, method, params });

describe('MCP JSON-RPC handling', () => {
  it('initializes with the requested protocol version when supported', async () => {
    const res = (await handleMcpMessage(
      req(1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } }),
      makeDeps()
    )) as { result: Record<string, unknown> };
    expect(res.result.protocolVersion).toBe('2025-03-26');
    expect(res.result.capabilities).toEqual({ tools: { listChanged: false } });
    expect(res.result.serverInfo).toEqual({ name: 'opslane', version: '1.0.0' });
    expect(res.result.instructions).toBe('Workspace runmora');
  });

  it('falls back to the latest version for unknown ones', async () => {
    const res = (await handleMcpMessage(req(1, 'initialize', { protocolVersion: '1999-01-01' }), makeDeps())) as {
      result: { protocolVersion: string };
    };
    expect(res.result.protocolVersion).toBe('2025-11-25');
  });

  it('answers ping and ignores notifications', async () => {
    expect(await handleMcpMessage(req(2, 'ping'), makeDeps())).toEqual({ jsonrpc: '2.0', id: 2, result: {} });
    expect(await handleMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, makeDeps())).toBeNull();
    expect(await handleMcpPayload({ jsonrpc: '2.0', method: 'notifications/initialized' }, makeDeps())).toBeNull();
  });

  it('lists tools', async () => {
    const res = (await handleMcpMessage(req(3, 'tools/list'), makeDeps())) as {
      result: { tools: Array<{ name: string; inputSchema: unknown }> };
    };
    expect(res.result.tools.map((t) => t.name)).toEqual(['search_customers', 'failing_tool']);
    expect(res.result.tools[0].inputSchema).toEqual({ type: 'object', properties: {} });
  });

  it('calls a tool and returns its result as text content', async () => {
    const res = (await handleMcpMessage(
      req(4, 'tools/call', { name: 'search_customers', arguments: { query: 'acme' } }),
      makeDeps()
    )) as { result: { content: Array<{ type: string; text: string }>; isError?: boolean } };
    expect(res.result.isError).toBeUndefined();
    expect(JSON.parse(res.result.content[0].text)).toEqual({
      customers: [{ id: 'c1', name: 'Match for acme' }],
    });
  });

  it('rejects unknown tools with invalid params', async () => {
    const res = await handleMcpMessage(req(5, 'tools/call', { name: 'drop_database' }), makeDeps());
    expect(res).toEqual({
      jsonrpc: '2.0',
      id: 5,
      error: { code: JSON_RPC_ERRORS.INVALID_PARAMS, message: 'Unknown tool: drop_database' },
    });
  });

  it('reports tool failures as isError results the model can read', async () => {
    const res = (await handleMcpMessage(req(6, 'tools/call', { name: 'failing_tool' }), makeDeps())) as {
      result: { content: Array<{ text: string }>; isError: boolean };
    };
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toBe('Customer not found');
  });

  it('validates tools/call params', async () => {
    const noName = await handleMcpMessage(req(7, 'tools/call', {}), makeDeps());
    expect(noName).toMatchObject({ error: { code: JSON_RPC_ERRORS.INVALID_PARAMS } });
    const badArgs = await handleMcpMessage(
      req(8, 'tools/call', { name: 'search_customers', arguments: ['x'] }),
      makeDeps()
    );
    expect(badArgs).toMatchObject({ error: { code: JSON_RPC_ERRORS.INVALID_PARAMS } });
  });

  it('returns method-not-found and invalid-request errors', async () => {
    expect(await handleMcpMessage(req(9, 'sampling/createMessage'), makeDeps())).toMatchObject({
      id: 9,
      error: { code: JSON_RPC_ERRORS.METHOD_NOT_FOUND },
    });
    expect(await handleMcpMessage({ id: 10, method: 'ping' }, makeDeps())).toMatchObject({
      id: 10,
      error: { code: JSON_RPC_ERRORS.INVALID_REQUEST },
    });
    expect(await handleMcpMessage('nope', makeDeps())).toMatchObject({
      id: null,
      error: { code: JSON_RPC_ERRORS.INVALID_REQUEST },
    });
  });

  it('handles batches, dropping notifications', async () => {
    const res = await handleMcpPayload(
      [req(1, 'ping'), { jsonrpc: '2.0', method: 'notifications/initialized' }, req(2, 'tools/list')],
      makeDeps()
    );
    expect(Array.isArray(res)).toBe(true);
    expect((res as Array<{ id: number }>).map((r) => r.id)).toEqual([1, 2]);
  });

  it('truncates huge results and serializes bigint', async () => {
    const deps = makeDeps({
      callTool: async () => ({ big: 'x'.repeat(MAX_TOOL_RESULT_CHARS + 10), n: BigInt(5) }),
    });
    const res = (await handleMcpMessage(req(11, 'tools/call', { name: 'any' }), deps)) as {
      result: { content: Array<{ text: string }> };
    };
    expect(res.result.content[0].text.length).toBeLessThan(MAX_TOOL_RESULT_CHARS + 200);
    expect(res.result.content[0].text).toContain('[truncated');
  });
});
