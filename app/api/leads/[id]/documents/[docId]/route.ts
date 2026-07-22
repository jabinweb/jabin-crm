import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { ApiErrors } from '@/lib/api-error-handler';
import { prisma } from '@/lib/prisma';

export const DELETE = withTenantRoute(async (_req, { companyId }, routeContext) => {
  const params = await routeContext!.params;
  const leadId = params.id;
  const docId = params.docId;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId },
    select: { id: true },
  });
  if (!lead) throw ApiErrors.notFound('Lead');

  const deleted = await prisma.leadDocument.deleteMany({
    where: { id: docId, leadId },
  });

  if (deleted.count === 0) {
    throw ApiErrors.notFound('Document');
  }

  return jsonOk({ success: true });
});
