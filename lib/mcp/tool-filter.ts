import { canRoleUseTool } from '@/lib/agent/tool-access';
import type { AgentToolDef } from '@/lib/agent/tool-types';
import type { FeatureModuleKey } from '@/lib/feature-module-keys';
import type { McpTokenScope } from '@/lib/mcp/token-format';

/**
 * Which OPS agent tools an MCP token may see and call: the same role + plan-module policy
 * as the in-app agent (`canRoleUseTool`), narrowed by the token scope — `read` tokens
 * never get tools that change data. Pure, so it is unit-tested without the tool registry.
 */
export function filterToolsForMcp<T extends Pick<AgentToolDef, 'name' | 'kind' | 'roles'>>(
  tools: T[],
  params: {
    role: string;
    modules?: Partial<Record<FeatureModuleKey, boolean>> | null;
    scope: McpTokenScope;
  }
): T[] {
  if (params.role === 'CUSTOMER') return [];
  return tools.filter(
    (t) =>
      (params.scope === 'read_write' || t.kind === 'read') &&
      canRoleUseTool(t.name, params.role, params.modules, t.roles)
  );
}

export type McpToolDescriptor = {
  name: string;
  title: string;
  description: string;
  inputSchema: AgentToolDef['parameters'];
  annotations: {
    title: string;
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
};

const DESTRUCTIVE_PREFIXES = ['delete_', 'remove_'];
/** Writes that reach people outside Opslane (email, WhatsApp, Slack…) */
const OUTBOUND_PREFIXES = ['send_', 'enroll_'];

function titleFor(name: string) {
  const words = name.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** MCP `tools/list` entry for an agent tool. Write tools say so up front. */
export function toMcpToolDescriptor(
  tool: Pick<AgentToolDef, 'name' | 'kind' | 'description' | 'parameters'>
): McpToolDescriptor {
  const isWrite = tool.kind === 'write';
  const destructive = isWrite && DESTRUCTIVE_PREFIXES.some((p) => tool.name.startsWith(p));
  const outbound = isWrite && OUTBOUND_PREFIXES.some((p) => tool.name.startsWith(p));
  const title = titleFor(tool.name);
  const prefix = !isWrite
    ? ''
    : destructive
      ? '[WRITE — deletes data in Opslane] '
      : outbound
        ? '[WRITE — changes data in Opslane and may message people] '
        : '[WRITE — changes data in Opslane] ';
  return {
    name: tool.name,
    title,
    description: `${prefix}${tool.description}`,
    inputSchema: {
      type: 'object',
      properties: tool.parameters?.properties ?? {},
      ...(tool.parameters?.required?.length ? { required: tool.parameters.required } : {}),
    },
    annotations: {
      title,
      readOnlyHint: !isWrite,
      destructiveHint: destructive,
      idempotentHint: !isWrite,
      openWorldHint: outbound,
    },
  };
}
