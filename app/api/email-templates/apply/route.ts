import { NextRequest, NextResponse } from 'next/server';
import { templateService } from '@/lib/email/template-service';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';

export async function POST(request: NextRequest) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');
    const body = await request.json();
    const { templateId, leadData } = body;

    if (!templateId || !leadData) {
      return NextResponse.json(
        { error: 'Template ID and lead data are required' },
        { status: 400 }
      );
    }

    const result = await templateService.applyTemplate(
      templateId,
      session.user.id,
      leadData
    );

    return NextResponse.json(result);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Template apply error:', error);
    return NextResponse.json({ error: 'Failed to apply template' }, { status: 500 });
  }
}
