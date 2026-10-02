import { NextResponse } from 'next/server';
import { checkOpsAccess, SALES_DOC_ROLES } from '@/lib/crm/ops-access';
import { withTenantRoute } from '@/lib/api/with-route';
import { getServiceContract } from '@/lib/crm/service-contract-service';
import { renderToBuffer } from '@react-pdf/renderer';
import { ContractPDF } from '@/lib/pdf/contract-pdf';
import { prisma } from '@/lib/prisma';

export const GET = withTenantRoute(async (_req, { session, companyId }, routeContext) => {
  // Contracts live under Support in the nav: sales and support roles, Tickets module
  const denied = await checkOpsAccess(session, companyId, { roles: SALES_DOC_ROLES, module: 'TICKETS' });
  if (denied) return denied;
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

  // contractNumber is user-entered; keep the Content-Disposition header well-formed
  const safeNumber = (contract.contractNumber || contract.id.slice(0, 8)).replace(/[^A-Za-z0-9._-]/g, '_');
  const filename = `contract-${safeNumber}.pdf`;
  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
