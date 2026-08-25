import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { PROJECT_INCLUDE } from '@/lib/projects/agency-delivery';

export const GET = withTenantRoute(async (_request, { companyId }, routeContext) => {
  const id = (await routeContext!.params).id;

  const project = await prisma.project.findFirst({
    where: { id, companyId },
    include: {
      ...PROJECT_INCLUDE,
      tickets: {
        take: 20,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          subject: true,
          status: true,
          priority: true,
          ticketType: true,
          createdAt: true,
        },
      },
      timesheetEntries: {
        take: 50,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          date: true,
          hours: true,
          billable: true,
          note: true,
          timesheet: {
            select: {
              employee: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const hoursLogged = project.timesheetEntries.reduce((s, e) => s + e.hours, 0);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  const settings =
    company?.settings && typeof company.settings === 'object'
      ? (company.settings as Record<string, unknown>)
      : {};

  return jsonOk({
    ...project,
    hoursLogged,
    projectTaskStatuses: settings.projectTaskStatuses ?? null,
  });
});

export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN', 'SALES')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = (await routeContext!.params).id;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (typeof body.name === 'string') data.name = body.name.trim();
  if (typeof body.description === 'string') data.description = body.description;
  if (typeof body.status === 'string') data.status = body.status;
  if (typeof body.projectType === 'string') data.projectType = body.projectType.trim();
  if (typeof body.progress === 'number') {
    data.progress = Math.max(0, Math.min(100, Math.round(body.progress)));
  }
  if (body.startDate) {
    const d = new Date(body.startDate);
    if (!Number.isNaN(d.getTime())) data.startDate = d;
  }
  if (body.endDate) {
    const d = new Date(body.endDate);
    if (!Number.isNaN(d.getTime())) data.endDate = d;
  }
  if (body.customerId !== undefined) {
    data.customerId =
      typeof body.customerId === 'string' && body.customerId.trim()
        ? body.customerId.trim()
        : null;
  }
  if (body.dealId !== undefined) {
    data.dealId =
      typeof body.dealId === 'string' && body.dealId.trim() ? body.dealId.trim() : null;
  }
  if (body.pmUserId !== undefined) {
    data.pmUserId =
      typeof body.pmUserId === 'string' && body.pmUserId.trim()
        ? body.pmUserId.trim()
        : null;
  }

  const existing = await prisma.project.findFirst({ where: { id, companyId } });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const project = await prisma.project.update({
    where: { id },
    data: data as Prisma.ProjectUpdateInput,
    include: PROJECT_INCLUDE,
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
