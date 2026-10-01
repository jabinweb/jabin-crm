import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/** Workspaces the signed-in staff user belongs to — drives the workspace switcher. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role === 'CUSTOMER') {
    return NextResponse.json({ workspaces: [] });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      primaryCompanyId: true,
      companyId: true,
      userCompanies: { select: { companyId: true } },
    },
  });
  const companyIds = Array.from(
    new Set(
      [
        user?.primaryCompanyId,
        user?.companyId,
        ...(user?.userCompanies ?? []).map((m: { companyId: string }) => m.companyId),
      ].filter((id): id is string => !!id)
    )
  );
  if (companyIds.length === 0) return NextResponse.json({ workspaces: [] });

  const companies = await prisma.company.findMany({
    where: { id: { in: companyIds }, status: 'APPROVED' },
    select: { id: true, name: true, slug: true, logo: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({
    workspaces: companies.map((company: { id: string; name: string; slug: string; logo: string | null }) => ({
      ...company,
      isHome: company.id === user?.primaryCompanyId,
    })),
  });
}
