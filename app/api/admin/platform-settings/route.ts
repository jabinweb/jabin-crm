import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import {
  getPlatformTenancyConfig,
  setPlatformTenancyMode,
} from '@/lib/tenancy/platform-settings';
import { parseTenancyMode } from '@/lib/tenancy/mode';
import {
  DEFAULT_PHP_UPLOAD_URL,
  getPhpUploadConfig,
  setPhpUploadConfig,
} from '@/lib/storage/php-upload-config';

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

  const [tenancy, upload] = await Promise.all([
    getPlatformTenancyConfig(),
    getPhpUploadConfig(),
  ]);

  return NextResponse.json({
    ...tenancy,
    phpUploadUrl: upload.url,
    phpUploadPasswordSet: upload.passwordConfigured,
    phpUploadSource: upload.source,
    phpUploadDefaultUrl: DEFAULT_PHP_UPLOAD_URL,
  });
}

const patchSchema = z.object({
  tenancyMode: z.enum(['path', 'subdomain']).optional(),
  phpUploadUrl: z.string().url().nullable().optional(),
  /** New password; omit or empty to keep existing */
  phpUploadPassword: z.string().nullable().optional(),
  clearPhpUploadPassword: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = patchSchema.parse(await req.json());

    if (body.tenancyMode) {
      const mode = parseTenancyMode(body.tenancyMode);
      if (!mode) {
        return NextResponse.json({ error: 'Invalid tenancy mode' }, { status: 400 });
      }
      await setPlatformTenancyMode(mode, session.user.id);
    }

    if (
      body.phpUploadUrl !== undefined ||
      body.phpUploadPassword !== undefined ||
      body.clearPhpUploadPassword
    ) {
      await setPhpUploadConfig({
        phpUploadUrl: body.phpUploadUrl,
        phpUploadPassword: body.phpUploadPassword,
        clearPassword: body.clearPhpUploadPassword === true,
        updatedBy: session.user.id,
      });
    }

    const [tenancy, upload] = await Promise.all([
      getPlatformTenancyConfig(),
      getPhpUploadConfig(),
    ]);

    return NextResponse.json({
      ...tenancy,
      phpUploadUrl: upload.url,
      phpUploadPasswordSet: upload.passwordConfigured,
      phpUploadSource: upload.source,
      phpUploadDefaultUrl: DEFAULT_PHP_UPLOAD_URL,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error('[platform-settings]', e);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
