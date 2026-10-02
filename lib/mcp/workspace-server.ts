import { prisma } from '@/lib/prisma';
import { isWorkspaceStaff } from '@/lib/auth/workspace-staff';
import { getFeatureModuleMap } from '@/lib/feature-modules';
import { AGENT_TOOLS } from '@/lib/agent/tools';
import { buildAgentContext } from '@/lib/agent/context';
import { resolveAgentApiKey } from '@/lib/agent/api-key';
import type { AgentToolDef } from '@/lib/agent/tool-types';
import { filterToolsForMcp, toMcpToolDescriptor } from '@/lib/mcp/tool-filter';
import { McpToolNotFoundError, type McpServerDeps } from '@/lib/mcp/json-rpc';
import type { ResolvedMcpToken } from '@/lib/mcp/token-store';
import { AuditLogger } from '@/lib/audit';

const auditLogger = new AuditLogger();

export const MCP_SERVER_NAME = 'opslane';
export const MCP_SERVER_VERSION = '1.0.0';

export type McpPrincipal = ResolvedMcpToken & {
  role: string;
  userName: string | null;
  companyName: string;
  companySlug: string;
};

/**
 * Re-checks, on every request, that the token's user may still act in the workspace:
 * the user exists, isn't a portal customer, and is still staff of that company (or a
 * platform super admin). Role comes from the user record now, not from token creation
 * time, so a demotion takes effect immediately.
 */
export async function resolveMcpPrincipal(token: ResolvedMcpToken): Promise<McpPrincipal | null> {
  const [user, company] = await Promise.all([
    prisma.user.findUnique({
      where: { id: token.userId },
      select: { id: true, role: true, name: true },
    }),
    prisma.company.findUnique({
      where: { id: token.companyId },
      select: { id: true, name: true, slug: true },
    }),
  ]);
  if (!user || !company) return null;
  const role = String(user.role);
  if (role === 'CUSTOMER') return null;
  if (role !== 'SUPER_ADMIN' && !(await isWorkspaceStaff(company.id, user.id))) return null;
  return {
    ...token,
    role,
    userName: user.name ?? null,
    companyName: company.name,
    companySlug: company.slug,
  };
}

async function allowedTools(principal: McpPrincipal): Promise<AgentToolDef[]> {
  const modules = await getFeatureModuleMap(principal.userId, principal.companyId);
  return filterToolsForMcp(AGENT_TOOLS, {
    role: principal.role,
    modules,
    scope: principal.scope,
  });
}

/** MCP server dependencies bound to one authenticated principal. */
export function createWorkspaceMcpDeps(principal: McpPrincipal): McpServerDeps {
  return {
    serverName: MCP_SERVER_NAME,
    serverVersion: MCP_SERVER_VERSION,
    instructions:
      `Opslane workspace "${principal.companyName}" (${principal.companySlug}). ` +
      `You act as ${principal.userName || 'this user'} with role ${principal.role}` +
      (principal.scope === 'read' ? ' and read-only access.' : '.') +
      ' Tools marked [WRITE] change live business data — confirm with the user before calling them.' +
      ' Use search/list tools to find ids before calling get_* or update tools.',
    listTools: async () => (await allowedTools(principal)).map(toMcpToolDescriptor),
    callTool: async (name, args) => {
      // Same check the in-app confirm step does: never run a tool the user couldn't be offered
      const tool = (await allowedTools(principal)).find((t) => t.name === name);
      if (!tool) throw new McpToolNotFoundError(name);

      const ctx = await buildAgentContext({
        companyId: principal.companyId,
        userId: principal.userId,
        userRole: principal.role,
        userName: principal.userName,
      });
      const apiKey = await resolveAgentApiKey(principal.userId).catch(() => undefined);
      if (tool.kind === 'read') return tool.execute(args, ctx, apiKey);

      // Writes leave an audit trail (in-app OPS writes are tracked as AgentToolRun rows)
      const audit = (status: 'success' | 'failure', errorMessage?: string) =>
        auditLogger.log({
          userId: principal.userId,
          action: `mcp:${tool.name}`,
          resource: 'mcp_tool',
          resourceId: principal.tokenId,
          metadata: { companyId: principal.companyId, tool: tool.name, args },
          status,
          errorMessage,
        });
      try {
        const result = await tool.execute(args, ctx, apiKey);
        await audit('success');
        return result;
      } catch (error) {
        await audit('failure', error instanceof Error ? error.message : 'Failed');
        throw error;
      }
    },
  };
}
