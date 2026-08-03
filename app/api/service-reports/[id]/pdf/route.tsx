import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { renderToBuffer } from '@react-pdf/renderer';
import { ServiceReportPDF } from '@/lib/pdf/service-report-pdf';
import { serviceReportService } from '@/lib/crm/service-report-service';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await withModuleAccess('SERVICE_REPORTS');
    const { id } = await params;
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
