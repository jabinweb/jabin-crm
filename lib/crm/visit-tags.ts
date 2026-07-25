import { prisma } from '@/lib/prisma';

export const DEFAULT_VISIT_TAGS: Array<{ name: string; color: string }> = [
  { name: 'Demo', color: '#2563eb' },
  { name: 'Scheduled visit', color: '#059669' },
  { name: 'Follow-up', color: '#d97706' },
  { name: 'Recurring', color: '#7c3aed' },
  { name: 'Night visit', color: '#0f172a' },
];

/** Ensure company has system visit tags; returns full tag list. */
export async function ensureVisitTags(companyId: string) {
  const existing = await prisma.visitTag.findMany({
    where: { companyId },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });

  const have = new Set(existing.map((t) => t.name.toLowerCase()));
  const missing = DEFAULT_VISIT_TAGS.filter((t) => !have.has(t.name.toLowerCase()));

  if (missing.length) {
    await prisma.visitTag.createMany({
      data: missing.map((t) => ({
        companyId,
        name: t.name,
        color: t.color,
        isSystem: true,
      })),
      skipDuplicates: true,
    });
    return prisma.visitTag.findMany({
      where: { companyId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  return existing;
}
