import 'dotenv/config';
import { prisma } from '../lib/prisma';

/**
 * Ensure jabincreators@gmail.com (and the gamil typo if present) is platform SUPER_ADMIN.
 * Clears company binding so they manage all workspaces from /admin.
 */
async function main() {
  const emails = ['jabincreators@gmail.com', 'jabincreators@gamil.com'];

  for (const email of emails) {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, role: true, companyId: true },
    });

    if (!existing) {
      if (email === 'jabincreators@gamil.com') {
        console.log('skip create for typo email:', email);
        continue;
      }
      continue;
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: 'SUPER_ADMIN',
        userStatus: 'ACTIVE',
        companyId: null,
        primaryCompanyId: null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
        primaryCompanyId: true,
      },
    });
    console.log('updated:', updated);
  }

  // Ensure gmail account exists as SUPER_ADMIN
  const gmail = await prisma.user.findFirst({
    where: { email: { equals: 'jabincreators@gmail.com', mode: 'insensitive' } },
  });
  if (!gmail) {
    console.log('WARNING: jabincreators@gmail.com not found — sign up first, then re-run.');
  } else {
    console.log('OK: jabincreators@gmail.com is SUPER_ADMIN. Sign out/in, then open /admin');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
