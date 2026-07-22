import { NextResponse } from 'next/server';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { ApiErrors } from '@/lib/api-error-handler';
import { prisma } from '@/lib/prisma';

const documentInclude = {
  uploadedBy: {
    select: {
      id: true,
      name: true,
      avatar: true,
    },
  },
} as const;

async function assertLeadInCompany(leadId: string, companyId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId },
    select: { id: true },
  });
  if (!lead) throw ApiErrors.notFound('Lead');
  return lead;
}

export const GET = withTenantRoute(async (_req, { companyId }, routeContext) => {
  const leadId = (await routeContext!.params).id;
  await assertLeadInCompany(leadId, companyId);

  const documents = await prisma.leadDocument.findMany({
    where: { leadId },
    include: documentInclude,
    orderBy: { createdAt: 'desc' },
  });

  return jsonOk({ documents });
});

export const POST = withTenantRoute(async (request, { companyId, employeeId }, routeContext) => {
  const leadId = (await routeContext!.params).id;
  await assertLeadInCompany(leadId, companyId);

  if (!employeeId) {
    throw ApiErrors.badRequest('Employee profile required to upload documents');
  }

  const contentType = request.headers.get('content-type') || '';
  let name: string;
  let type: string;
  let url: string;

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const fileEntry = formData.get('file');
    const file = fileEntry instanceof File ? fileEntry : null;
    const nameEntry = formData.get('name');
    const typeEntry = formData.get('type');

    if (!file) {
      throw ApiErrors.badRequest('No file provided');
    }

    const phpUploadUrl =
      process.env.NEXT_PUBLIC_PHP_UPLOAD_URL || 'https://files.jabin.org/api/upload.php';
    const phpFormData = new FormData();
    phpFormData.append('file', file);
    phpFormData.append('folder', `leads/${leadId}`);

    const uploadRes = await fetch(phpUploadUrl, {
      method: 'POST',
      body: phpFormData,
    });

    if (!uploadRes.ok) {
      const errorData = await uploadRes.json().catch(() => ({ error: 'Upload failed' }));
      return NextResponse.json(
        { error: errorData.error || 'Upload failed' },
        { status: uploadRes.status }
      );
    }

    const uploadData = await uploadRes.json();
    url = uploadData.url || uploadData.file_url;
    if (!url) {
      throw ApiErrors.badRequest('Upload did not return a file URL');
    }
    name =
      (typeof nameEntry === 'string' && nameEntry.trim()) || file.name;
    type =
      (typeof typeEntry === 'string' && typeEntry.trim()) ||
      file.type ||
      'application/octet-stream';
  } else {
    const body = await request.json();
    name = typeof body.name === 'string' ? body.name.trim() : '';
    type = typeof body.type === 'string' ? body.type.trim() : '';
    url = typeof body.url === 'string' ? body.url.trim() : '';

    if (!name || !url) {
      throw ApiErrors.badRequest('name and url are required');
    }
    if (!type) {
      type = 'application/octet-stream';
    }
  }

  const document = await prisma.leadDocument.create({
    data: {
      leadId,
      name,
      type,
      url,
      employeeId,
    },
    include: documentInclude,
  });

  return jsonOk(document, { status: 201 });
});
