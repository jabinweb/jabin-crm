import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { renderToBuffer } from '@react-pdf/renderer';
import { ServiceReportPDF } from '@/lib/pdf/service-report-pdf';
import { serviceReportService } from '@/lib/crm/service-report-service';
import { prisma } from '@/lib/prisma';
import { requireTicketRouteAccess } from '@/lib/tenant/ticket-route-guard';
import type { Session } from 'next-auth';

/** Report must belong to a ticket the caller can access (own ticket for portal customers). */
async function requireServiceReportAccess(session: Session, req: NextRequest, reportId: string) {
  const row = await prisma.serviceReport.findUnique({
    where: { id: reportId },
    select: { ticketId: true },
  });
  if (!row) {
    return { ok: false as const, response: NextResponse.json({ error: 'Report not found' }, { status: 404 }) };
  }
  const guard = await requireTicketRouteAccess(session, req, row.ticketId);
  if (!guard.ok) {
    return { ok: false as const, response: NextResponse.json({ error: 'Report not found' }, { status: 404 }) };
  }
  return { ok: true as const };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('SERVICE_REPORTS');
    const { id } = await params;
    const guard = await requireServiceReportAccess(session, req, id);
    if (!guard.ok) return guard.response;
    const report = await serviceReportService.getReportById(id);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const equipment = report.ticket.equipment;
    const equipmentLabel = equipment
      ? [equipment.product?.name, equipment.serialNumber].filter(Boolean).join(' · ')
      : undefined;

    const buffer = await renderToBuffer(
      ServiceReportPDF({
        reportId: report.id,
        ticketSubject: report.ticket.subject,
        ticketId: report.ticketId,
        customerName: report.ticket.customer.organizationName,
        technicianName: report.technician.name || report.technician.email || 'Technician',
        serviceNotes: report.serviceNotes,
        partsReplaced: report.partsReplaced || undefined,
        nextMaintenanceDate: report.nextMaintenanceDate?.toISOString(),
        createdAt: report.createdAt.toISOString(),
        customerSignerName: report.customerSignerName || undefined,
        signedAt: report.signedAt?.toISOString(),
        signatureDataUrl: report.signatureDataUrl || undefined,
        equipmentLabel,
      })
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="service-report-${report.id.slice(-8)}.pdf"`,
      },
    });
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Service report PDF error', error);
    }
    return handleApiError(error);
  }
}
