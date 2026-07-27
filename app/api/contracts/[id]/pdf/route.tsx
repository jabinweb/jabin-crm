import { NextResponse } from 'next/server';
import { withTenantRoute } from '@/lib/api/with-route';
import { getServiceContract } from '@/lib/crm/service-contract-service';
import { renderToBuffer } from '@react-pdf/renderer';
import { ContractPDF } from '@/lib/pdf/contract-pdf';
import { prisma } from '@/lib/prisma';

export const GET = withTenantRoute(async (_req, { companyId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const contract = await getServiceContract(companyId, id);
  if (!contract) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, email: true, phone: true },
  });

  const pdfData = {
    title: contract.title,
    type: contract.type,
    status: contract.status,
    contractNumber: contract.contractNumber,
    startDate: contract.startDate.toISOString(),
    endDate: contract.endDate.toISOString(),
    annualValue: contract.annualValue,
    currency: contract.currency,
    includesParts: contract.includesParts,
    visitLimit: contract.visitLimit,
    visitsUsed: contract.visitsUsed,
    notes: contract.notes,
    customerName: contract.customer.organizationName,
    customerCity: contract.customer.city,
    equipmentName: contract.equipment?.product?.name ?? null,
    equipmentSerial: contract.equipment?.serialNumber ?? null,
    companyName: company?.name || 'Company',
    companyAddress: undefined as string | undefined,
    companyEmail: company?.email || undefined,
    companyPhone: company?.phone || undefined,
  };

  const element = <ContractPDF contract={pdfData} />;
  const buffer = await renderToBuffer(element);

  const filename = `contract-${contract.contractNumber || contract.id.slice(0, 8)}.pdf`;
  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
