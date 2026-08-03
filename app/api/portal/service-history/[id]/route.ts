import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { serviceReportService } from '@/lib/crm/service-report-service';
import { renderToBuffer } from '@react-pdf/renderer';
import { ServiceReportPDF } from '@/lib/pdf/service-report-pdf';

async function assertPortalAccess(reportId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { customerId: true, role: true },
  });
  const report = await serviceReportService.getReportById(reportId);
  if (!report) return { error: 'Not found' as const, status: 404 as const };

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  if (!isAdmin && user?.customerId !== report.ticket.customerId) {
    return { error: 'Forbidden' as const, status: 403 as const };
  }
  return { report };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const access = await assertPortalAccess(id, session.user.id);
  if ('error' in access && access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const report = access.report!;
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
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const access = await assertPortalAccess(id, session.user.id);
  if ('error' in access && access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await req.json();
  if (!body.customerSignerName || !body.signatureDataUrl) {
    return NextResponse.json(
      { error: 'Signer name and signature are required' },
      { status: 400 }
    );
  }

  const updated = await serviceReportService.acknowledgeReport(id, {
    customerSignerName: String(body.customerSignerName),
    signatureDataUrl: String(body.signatureDataUrl),
  });
  return NextResponse.json(updated);
}
