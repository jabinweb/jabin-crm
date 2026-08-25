/**
 * Upsert only PlatformSetting PHP upload URL + password (no full demo seed).
 * Usage: pnpm exec ts-node -r tsconfig-paths/register -r dotenv/config scripts/seed-php-upload-settings.ts
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma';

const URL = 'https://files.jabin.org/api/upload.php';
const PASSWORD =
  process.env.PHP_UPLOAD_PASSWORD?.trim() || 'scio-admin-2026';

async function main() {
  await prisma.platformSetting.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      tenancyMode: 'path',
      phpUploadUrl: URL,
      phpUploadPassword: PASSWORD,
    },
    update: {
      phpUploadUrl: URL,
      phpUploadPassword: PASSWORD,
    },
  });

  const row = await prisma.platformSetting.findUnique({
    where: { id: 'default' },
    select: { phpUploadUrl: true, phpUploadPassword: true },
  });

  console.log(
    JSON.stringify({
      phpUploadUrl: row?.phpUploadUrl,
      passwordSet: !!row?.phpUploadPassword,
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
