import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { resolveOptionalStaffCompanyScope } from '@/lib/tenant/scope-staff-query';
import { listRenewalAlerts } from '@/lib/crm/service-contract-service';
import { TenantError } from '@/lib/auth/company-membership';
import { handleRouteError } from '@/lib/api/tenant-response';

function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60);
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'TICKETS');

    const companyId = await resolveOptionalStaffCompanyScope(session, req);
    if (!companyId && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Company context required' }, { status: 400 });
    }

    const parsedDays = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10);
    const days = Number.isFinite(parsedDays) ? Math.min(Math.max(parsedDays, 1), 365) : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const ticketWhere = {
      createdAt: { gte: since },
      mergedIntoId: null as null,
      ...(companyId ? { customer: { companyId } } : {}),
    };

    const tickets = await prisma.supportTicket.findMany({
      where: ticketWhere,
      select: {
        id: true,
        status: true,
        createdAt: true,
        firstRespondedAt: true,
        resolvedAt: true,
        updatedAt: true,
        assignedTechnicianId: true,
        assignedTechnician: { select: { id: true, name: true } },
      },
    });

    const mttrHours: number[] = [];
    const firstResponseHours: number[] = [];
    const byTech = new Map<
      string,
      { id: string; name: string; open: number; resolved: number; reports: number }
    >();

    for (const t of tickets) {
      const techId = t.assignedTechnicianId || 'unassigned';
      const techName = t.assignedTechnician?.name || 'Unassigned';
      if (!byTech.has(techId)) {
        byTech.set(techId, {
          id: techId,
          name: techName,
          open: 0,
          resolved: 0,
          reports: 0,
        });
      }
      const row = byTech.get(techId)!;
      if (['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)) row.open += 1;
      if (['RESOLVED', 'CLOSED'].includes(t.status)) row.resolved += 1;

      const resolvedAt = t.resolvedAt || (['RESOLVED', 'CLOSED'].includes(t.status) ? t.updatedAt : null);
      if (resolvedAt) {
        mttrHours.push(hoursBetween(t.createdAt, resolvedAt));
      }
      if (t.firstRespondedAt) {
        firstResponseHours.push(hoursBetween(t.createdAt, t.firstRespondedAt));
      }
    }

    const reports = await prisma.serviceReport.findMany({
      where: {
        createdAt: { gte: since },
        ...(companyId ? { ticket: { customer: { companyId } } } : {}),
      },
      select: { technicianId: true },
    });
    for (const r of reports) {
      const row = byTech.get(r.technicianId);
      if (row) row.reports += 1;
      else {
        byTech.set(r.technicianId, {
          id: r.technicianId,
          name: 'Technician',
          open: 0,
          resolved: 0,
          reports: 1,
        });
      }
    }

    const avg = (arr: number[]) =>
      arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

    let renewals: unknown[] = [];
    if (companyId) {
      try {
        renewals = await listRenewalAlerts(companyId);
      } catch {
        renewals = [];
      }
    }

    return NextResponse.json({
      periodDays: days,
      totals: {
        tickets: tickets.length,
        open: tickets.filter((t) =>
          ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)
        ).length,
        resolved: tickets.filter((t) =>
          ['RESOLVED', 'CLOSED'].includes(t.status)
        ).length,
        reports: reports.length,
      },
      mttrHours: avg(mttrHours),
      firstResponseHours: avg(firstResponseHours),
      technicians: Array.from(byTech.values()).sort((a, b) => b.open - a.open),
      renewalsDue: renewals,
    });
  } catch (error) {
    // TenantError (403/404) and feature-gate ApiException (403) keep their status
    if (error instanceof TenantError || (error instanceof Error && 'statusCode' in error)) {
      return handleRouteError(error);
    }
    console.error('[service-stats]', error);
    return NextResponse.json({ error: 'Failed to load service stats' }, { status: 500 });
  }
}
