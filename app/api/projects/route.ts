import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withTenantRoute(async (_request, { companyId }) => {
  const projects = await prisma.project.findMany({
    where: { companyId },
    orderBy: { updatedAt: 'desc' },
  });
  return jsonOk(projects);
});

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const description = typeof body.description === 'string' ? body.description : '';
  const status = typeof body.status === 'string' ? body.status : 'ACTIVE';
  const start = body.startDate ? new Date(body.startDate) : new Date();
  const end = body.endDate ? new Date(body.endDate) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid dates' }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: { name, description, status, startDate: start, endDate: end, companyId },
  });

  return jsonOk(project, { status: 201 });
});
