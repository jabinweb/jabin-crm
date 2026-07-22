import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import {
  getPlatformTenancyConfig,
  setPlatformTenancyMode,
} from '@/lib/tenancy/platform-settings';
import { parseTenancyMode } from '@/lib/tenancy/mode';

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== UserRole.SUPER_ADMIN) {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await getPlatformTenancyConfig();
  return NextResponse.json(config);
}

const patchSchema = z.object({
  tenancyMode: z.enum(['path', 'subdomain']),
});

export async function PATCH(req: Request) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = patchSchema.parse(await req.json());
    const mode = parseTenancyMode(body.tenancyMode);
    if (!mode) {
      return NextResponse.json({ error: 'Invalid tenancy mode' }, { status: 400 });
    }

    const config = await setPlatformTenancyMode(mode, session.user.id);
    return NextResponse.json(config);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error('[platform-settings]', e);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
