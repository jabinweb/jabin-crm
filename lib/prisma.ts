/**
 * Prisma client factory.
 *
 * - If `DATABASE_URL` is an Accelerate URL (`prisma://...`), use Edge client + Accelerate extension.
 * - Otherwise use the normal Node.js Prisma Client with a driver adapter.
 *
 * This avoids runtime/constructor validation issues when mixing Accelerate with the Node client.
 */
type AppPrismaClient = any;

/**
 * pg ≥8 warns when sslmode is require/prefer/verify-ca without an explicit choice for the
 * upcoming libpq-aligned behavior. Using verify-full preserves today's stricter semantics.
 */
function normalizePostgresConnectionString(raw: string): string {
  if (!raw || raw.startsWith("prisma://")) return raw;
  try {
    const u = new URL(raw);
    const mode = (u.searchParams.get("sslmode") || "").toLowerCase();
    if (!mode) return raw;
    if (u.searchParams.get("uselibpqcompat") === "true") return raw;
    if (mode === "require" || mode === "prefer" || mode === "verify-ca") {
      u.searchParams.set("sslmode", "verify-full");
      return u.toString();
    }
    return raw;
  } catch {
    return raw;
  }
}

function createPrismaClient(): AppPrismaClient {
  const url = normalizePostgresConnectionString(String(process.env.DATABASE_URL || ""));

  if (url.startsWith("prisma://")) {
    // Prisma Accelerate / Data Proxy URLs use `prisma://...`
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaClient } = require("@prisma/client/edge");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { withAccelerate } = require("@prisma/extension-accelerate");
    return new PrismaClient().$extends(withAccelerate());
  }

  // Node.js client with Prisma 7 driver adapter (no url in schema).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require("@prisma/client/index");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaPg } = require("@prisma/adapter-pg");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require("pg");

  const pool = new Pool({ connectionString: url });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: AppPrismaClient | undefined;
};

function getPrismaClient(): AppPrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Lazy proxy to avoid Prisma initialization during Next build-time module eval.
const prisma = new Proxy({} as AppPrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient() as any;
    const value = client[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return Reflect.get(client, prop, receiver);
  },
}) as AppPrismaClient;

if (process.env.NODE_ENV !== "production") {
  // Don't eagerly initialize Prisma in dev; proxy imports can run before env is ready.
}

export { prisma };
export default prisma;
