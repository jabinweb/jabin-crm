/**
 * @jest-environment node
 */
jest.mock('@/lib/prisma', () => ({
  prisma: {
    userSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { createMcpToken, listMcpTokens, resolveMcpToken, revokeMcpToken } from '@/lib/mcp/token-store';

const userSession = (prisma as unknown as { userSession: Record<string, jest.Mock> }).userSession;

type StoredRow = {
  id: string;
  userId: string;
  userAgent: string;
  expiresAt: Date;
  lastActive: Date;
  isValid: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

let rows: StoredRow[] = [];

beforeEach(() => {
  rows = [];
  jest.clearAllMocks();
  userSession.create.mockImplementation(async ({ data }: { data: Omit<StoredRow, 'id'> }) => {
    const row = { id: `clxtoken${rows.length + 1}abcdef`, ...data } as StoredRow;
    rows.push(row);
    return row;
  });
  userSession.findUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id) ?? null
  );
  userSession.findMany.mockImplementation(async ({ where }: { where: { userId: string } }) =>
    rows.filter((r) => r.userId === where.userId && r.isValid && r.expiresAt > new Date())
  );
  userSession.update.mockResolvedValue({});
  userSession.deleteMany.mockImplementation(async ({ where }: { where: { id: string; userId: string } }) => {
    const before = rows.length;
    rows = rows.filter((r) => !(r.id === where.id && r.userId === where.userId));
    return { count: before - rows.length };
  });
});

describe('MCP token store', () => {
  it('stores only a hash and resolves the plain token once', async () => {
    const { token, view } = await createMcpToken({
      userId: 'u1',
      companyId: 'co1',
      name: 'Laptop',
      scope: 'read_write',
      expiresInDays: 30,
    });
    const stored = rows[0];
    const secret = token.split('_').slice(2).join('_');
    expect(JSON.stringify(stored)).not.toContain(secret);
    expect(stored.metadata).toMatchObject({ kind: 'mcp_token', companyId: 'co1', scope: 'read_write' });
    expect(view).toMatchObject({ name: 'Laptop', scope: 'read_write', lastUsedAt: null });

    await expect(resolveMcpToken(token)).resolves.toEqual({
      tokenId: stored.id,
      userId: 'u1',
      companyId: 'co1',
      scope: 'read_write',
    });
  });

  it('rejects wrong secrets, expired and revoked tokens', async () => {
    const { token } = await createMcpToken({
      userId: 'u1',
      companyId: 'co1',
      name: 'x',
      scope: 'read',
      expiresInDays: 30,
    });
    const [, id] = token.split('_');
    await expect(resolveMcpToken(`opl_${id}_${'A'.repeat(43)}`)).resolves.toBeNull();
    await expect(resolveMcpToken('garbage')).resolves.toBeNull();

    rows[0].expiresAt = new Date(Date.now() - 1000);
    await expect(resolveMcpToken(token)).resolves.toBeNull();

    rows[0].expiresAt = new Date(Date.now() + 86_400_000);
    rows[0].isValid = false;
    await expect(resolveMcpToken(token)).resolves.toBeNull();
  });

  it('ignores user-session rows that are not MCP tokens', async () => {
    rows.push({
      id: 'clxsession1abcdef',
      userId: 'u1',
      userAgent: 'Mozilla',
      expiresAt: new Date(Date.now() + 86_400_000),
      lastActive: new Date(),
      isValid: true,
      metadata: {},
      createdAt: new Date(),
    });
    await expect(resolveMcpToken(`opl_clxsession1abcdef_${'A'.repeat(43)}`)).resolves.toBeNull();
    await expect(listMcpTokens('u1', 'co1')).resolves.toEqual([]);
  });

  it('lists per workspace and revokes only your own tokens', async () => {
    await createMcpToken({ userId: 'u1', companyId: 'co1', name: 'a', scope: 'read', expiresInDays: 30 });
    await createMcpToken({ userId: 'u1', companyId: 'co2', name: 'b', scope: 'read', expiresInDays: 30 });
    expect((await listMcpTokens('u1', 'co1')).map((t) => t.name)).toEqual(['a']);

    const id = rows[0].id;
    await expect(revokeMcpToken('someone-else', id)).resolves.toBe(false);
    await expect(revokeMcpToken('u1', id)).resolves.toBe(true);
    expect(await listMcpTokens('u1', 'co1')).toEqual([]);
  });
});
