import { NextRequest, NextResponse } from 'next/server';
import { templateService } from '@/lib/email/template-service';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');
    const params = await context.params;
    const template = await templateService.getTemplateById(params.id, session.user.id);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Template fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');
    const params = await context.params;
    const body = await request.json();
    const { name, subject, body: templateBody, category, isDefault } = body;

    const template = await templateService.updateTemplate(params.id, session.user.id, {
      name,
      subject,
      body: templateBody,
      category,
      isDefault,
    });

    return NextResponse.json(template);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Template update error:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');
    const params = await context.params;
    await templateService.deleteTemplate(params.id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Template deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
