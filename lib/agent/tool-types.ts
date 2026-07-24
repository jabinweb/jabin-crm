import type { AgentRuntimeContext } from '@/lib/agent/context';

export type ToolKind = 'read' | 'write';

export type AgentToolDef = {
  name: string;
  description: string;
  kind: ToolKind;
  /** Roles that may use this tool. Empty = all authenticated staff. */
  roles?: string[];
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (
    args: Record<string, unknown>,
    ctx: AgentRuntimeContext,
    apiKey?: string
  ) => Promise<unknown>;
};
