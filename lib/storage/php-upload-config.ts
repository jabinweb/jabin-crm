import { prisma } from '@/lib/prisma';

const PLATFORM_SETTING_ID = 'default';
export const DEFAULT_PHP_UPLOAD_URL = 'https://files.jabin.org/api/upload.php';

export type PhpUploadConfig = {
  url: string;
  password: string | null;
  /** Where the URL came from */
  source: 'database' | 'env' | 'default';
  passwordConfigured: boolean;
};

/**
 * Resolve PHP upload endpoint from PlatformSetting (super-admin DB),
 * then env, then hardcoded default. Password is DB-only (never from env).
 */
export async function getPhpUploadConfig(): Promise<PhpUploadConfig> {
  try {
    const row = await prisma.platformSetting.findUnique({
      where: { id: PLATFORM_SETTING_ID },
      select: { phpUploadUrl: true, phpUploadPassword: true },
    });
    const dbUrl = row?.phpUploadUrl?.trim();
    const password = row?.phpUploadPassword?.trim() || null;
    if (dbUrl) {
      return {
        url: dbUrl,
        password,
        source: 'database',
        passwordConfigured: !!password,
      };
    }
    if (password) {
      const envUrl =
        process.env.NEXT_PUBLIC_PHP_UPLOAD_URL?.trim() || DEFAULT_PHP_UPLOAD_URL;
      return {
        url: envUrl,
        password,
        source: process.env.NEXT_PUBLIC_PHP_UPLOAD_URL ? 'env' : 'default',
        passwordConfigured: true,
      };
    }
  } catch {
    // Table may not exist yet
  }

  const envUrl = process.env.NEXT_PUBLIC_PHP_UPLOAD_URL?.trim();
  if (envUrl) {
    return {
      url: envUrl,
      password: null,
      source: 'env',
      passwordConfigured: false,
    };
  }

  return {
    url: DEFAULT_PHP_UPLOAD_URL,
    password: null,
    source: 'default',
    passwordConfigured: false,
  };
}

export async function setPhpUploadConfig(params: {
  phpUploadUrl?: string | null;
  /** Pass null to clear; omit / empty string to leave unchanged */
  phpUploadPassword?: string | null | undefined;
  clearPassword?: boolean;
  updatedBy?: string | null;
}): Promise<PhpUploadConfig> {
  const existing = await prisma.platformSetting.findUnique({
    where: { id: PLATFORM_SETTING_ID },
  });

  const nextUrl =
    params.phpUploadUrl !== undefined
      ? params.phpUploadUrl?.trim() || DEFAULT_PHP_UPLOAD_URL
      : existing?.phpUploadUrl?.trim() || DEFAULT_PHP_UPLOAD_URL;

  let nextPassword: string | null | undefined = undefined;
  if (params.clearPassword) {
    nextPassword = null;
  } else if (params.phpUploadPassword !== undefined) {
    const trimmed = params.phpUploadPassword?.trim() ?? '';
    if (trimmed.length > 0) {
      nextPassword = trimmed;
    }
    // empty string → leave existing password unchanged (undefined)
  }

  await prisma.platformSetting.upsert({
    where: { id: PLATFORM_SETTING_ID },
    create: {
      id: PLATFORM_SETTING_ID,
      tenancyMode: existing?.tenancyMode || 'path',
      phpUploadUrl: nextUrl,
      phpUploadPassword: nextPassword ?? null,
      updatedBy: params.updatedBy ?? null,
    },
    update: {
      phpUploadUrl: nextUrl,
      ...(nextPassword !== undefined ? { phpUploadPassword: nextPassword } : {}),
      updatedBy: params.updatedBy ?? null,
    },
  });

  return getPhpUploadConfig();
}

/** Build FormData extras + headers for the PHP upload forward. */
export function applyPhpUploadAuth(
  formData: FormData,
  password: string | null
): HeadersInit | undefined {
  if (!password) return undefined;
  formData.append('password', password);
  return {
    'X-Upload-Password': password,
    'X-API-Key': password,
  };
}
