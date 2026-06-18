import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withApiRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withApiRoute({
  auth: 'session',
  handler: async (request, { session }, routeContext) => {
    const companyId = (await routeContext!.params).id?.trim();

    if (!companyId) {
      return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
    }

    if (!hasLegacyRole(session, 'SUPER_ADMIN')) {
      const { resolveCompanyContextFromRequest } = await import('@/lib/auth/company-membership');
      const ctx = await resolveCompanyContextFromRequest(session, request);
      if (ctx.companyId !== companyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        website: true,
        logo: true,
        status: true,
        createdAt: true,
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return jsonOk(company);
  },
});

export const PATCH = withApiRoute({
  auth: 'session',
  handler: async (request, { session }, routeContext) => {
    const companyId = (await routeContext!.params).id?.trim();

    if (!companyId) {
      return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
    }

    if (!hasLegacyRole(session, 'SUPER_ADMIN')) {
      const { resolveCompanyContextFromRequest } = await import('@/lib/auth/company-membership');
      const ctx = await resolveCompanyContextFromRequest(session, request);
      if (ctx.companyId !== companyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const data = await request.json();

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        name: data.name,
        website: data.website,
        logo: data.logo,
        status: data.status,
      },
    });

    return jsonOk(company);
  },
});
