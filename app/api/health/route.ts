import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  let dbOk = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? 'healthy' : 'degraded';
  const code = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? 'up' : 'down',
      },
      latencyMs: Date.now() - started,
      version: process.env.npm_package_version ?? 'unknown',
    },
    { status: code }
  );
}
