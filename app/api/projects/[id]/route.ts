import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withTenantRoute(async (_request, { companyId }, routeContext) => {
  const id = (await routeContext!.params).id;

  const project = await prisma.project.findFirst({ where: { id, companyId } });
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return jsonOk(project);
});

export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = (await routeContext!.params).id;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (typeof body.name === 'string') data.name = body.name.trim();
  if (typeof body.description === 'string') data.description = body.description;
  if (typeof body.status === 'string') data.status = body.status;
  if (body.startDate) {
    const d = new Date(body.startDate);
    if (!Number.isNaN(d.getTime())) data.startDate = d;
  }
  if (body.endDate) {
    const d = new Date(body.endDate);
    if (!Number.isNaN(d.getTime())) data.endDate = d;
  }

  const existing = await prisma.project.findFirst({ where: { id, companyId } });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const project = await prisma.project.update({
    where: { id },
    data: data as Prisma.ProjectUpdateInput,
  });

  return jsonOk(project);
});

export const DELETE = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = (await routeContext!.params).id;
  const deleted = await prisma.project.deleteMany({ where: { id, companyId } });

  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return new Response(null, { status: 204 });
});
