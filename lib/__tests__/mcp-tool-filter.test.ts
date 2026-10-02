import { filterToolsForMcp, toMcpToolDescriptor } from '@/lib/mcp/tool-filter';

// Shapes of real registry entries (names drive the access table in tool-access.ts)
const TOOLS = [
  { name: 'get_company_snapshot', kind: 'read' as const },
  { name: 'search_customers', kind: 'read' as const },
  { name: 'list_overdue_invoices', kind: 'read' as const },
  { name: 'create_invoice', kind: 'write' as const },
  { name: 'list_projects', kind: 'read' as const },
  { name: 'update_project_task', kind: 'write' as const },
  { name: 'create_project', kind: 'write' as const },
  { name: 'payroll_summary', kind: 'read' as const },
];

const names = (tools: Array<{ name: string }>) => tools.map((t) => t.name);

describe('MCP tool filtering', () => {
  it('gives read-only tokens no write tools, even for admins', () => {
    const tools = filterToolsForMcp(TOOLS, { role: 'ADMIN', modules: null, scope: 'read' });
    expect(tools.every((t) => t.kind === 'read')).toBe(true);
    expect(names(tools)).toContain('payroll_summary');
  });

  it('gives read-write admin tokens everything their role allows', () => {
    expect(names(filterToolsForMcp(TOOLS, { role: 'ADMIN', scope: 'read_write' }))).toEqual(
      names(TOOLS)
    );
  });

  it('applies the role policy', () => {
    const tech = names(filterToolsForMcp(TOOLS, { role: 'TECHNICIAN', scope: 'read_write' }));
    expect(tech).toEqual(
      expect.arrayContaining(['get_company_snapshot', 'list_projects', 'update_project_task'])
    );
    expect(tech).not.toContain('search_customers');
    expect(tech).not.toContain('create_invoice');
    expect(tech).not.toContain('create_project');
    expect(tech).not.toContain('payroll_summary');
  });

  it('drops tools whose plan module is off', () => {
    const tools = names(
      filterToolsForMcp(TOOLS, {
        role: 'SALES',
        modules: { INVOICES: false },
        scope: 'read_write',
      })
    );
    expect(tools).not.toContain('list_overdue_invoices');
    expect(tools).not.toContain('create_invoice');
    expect(tools).toContain('search_customers');
  });

  it('never exposes anything to customers', () => {
    expect(filterToolsForMcp(TOOLS, { role: 'CUSTOMER', scope: 'read_write' })).toEqual([]);
  });

  it('labels write tools and sets MCP annotations', () => {
    const params = { type: 'object' as const, properties: { id: { type: 'string' } }, required: ['id'] };
    const read = toMcpToolDescriptor({ name: 'get_invoice', kind: 'read', description: 'Get one.', parameters: params });
    expect(read.description).toBe('Get one.');
    expect(read.annotations.readOnlyHint).toBe(true);
    expect(read.inputSchema).toEqual(params);

    const del = toMcpToolDescriptor({ name: 'delete_project_task', kind: 'write', description: 'Delete.', parameters: { type: 'object', properties: {} } });
    expect(del.description.startsWith('[WRITE')).toBe(true);
    expect(del.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(del.inputSchema).toEqual({ type: 'object', properties: {} });

    const send = toMcpToolDescriptor({ name: 'send_invoice', kind: 'write', description: 'Send.', parameters: params });
    expect(send.description).toContain('may message people');
    expect(send.annotations.openWorldHint).toBe(true);
  });
});
