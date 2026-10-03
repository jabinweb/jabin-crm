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
import { getLiveKitConfigSummary, setLiveKitConfig } from '@/lib/meetings/livekit-config';

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

  const [tenancy, upload, livekit] = await Promise.all([
    getPlatformTenancyConfig(),
    getPhpUploadConfig(),
    getLiveKitConfigSummary(),
  ]);

  return NextResponse.json({
    ...tenancy,
    phpUploadUrl: upload.url,
    phpUploadPasswordSet: upload.passwordConfigured,
    phpUploadSource: upload.source,
    phpUploadDefaultUrl: DEFAULT_PHP_UPLOAD_URL,
    ...livekit,
  });
}

const patchSchema = z.object({
  tenancyMode: z.enum(['path', 'subdomain']).optional(),
  phpUploadUrl: z.string().url().nullable().optional(),
  /** New password; omit or empty to keep existing */
  phpUploadPassword: z.string().nullable().optional(),
  clearPhpUploadPassword: z.boolean().optional(),
  livekitUrl: z
    .string()
    .regex(/^wss?:\/\/\S+$/, 'LiveKit URL must start with wss:// (or ws:// for local)')
    .nullable()
    .optional(),
  livekitApiKey: z.string().max(200).nullable().optional(),
  /** New secret; omit or empty to keep existing */
  livekitApiSecret: z.string().max(500).nullable().optional(),
  clearLivekit: z.boolean().optional(),
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

    if (
      body.clearLivekit ||
      body.livekitUrl !== undefined ||
      body.livekitApiKey !== undefined ||
      body.livekitApiSecret !== undefined
    ) {
      await setLiveKitConfig({
        url: body.livekitUrl,
        apiKey: body.livekitApiKey,
        apiSecret: body.livekitApiSecret,
        clear: body.clearLivekit === true,
        updatedBy: session.user.id,
      });
    }

    const [tenancy, upload, livekit] = await Promise.all([
      getPlatformTenancyConfig(),
      getPhpUploadConfig(),
      getLiveKitConfigSummary(),
    ]);

    return NextResponse.json({
      ...tenancy,
      phpUploadUrl: upload.url,
      phpUploadPasswordSet: upload.passwordConfigured,
      phpUploadSource: upload.source,
      phpUploadDefaultUrl: DEFAULT_PHP_UPLOAD_URL,
      ...livekit,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error('[platform-settings]', e);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
