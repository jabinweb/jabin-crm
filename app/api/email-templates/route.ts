import { NextRequest, NextResponse } from 'next/server';
import { templateService } from '@/lib/email/template-service';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';

export async function GET(request: NextRequest) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const templates = await templateService.getUserTemplates(
      session.user.id,
      category || undefined
    );

    return NextResponse.json(templates);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Template fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');

    const body = await request.json();
    const { name, subject, body: templateBody, category, isDefault } = body;

    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: 'Name, subject, and body are required' },
        { status: 400 }
      );
    }

    const template = await templateService.createTemplate({
      userId: session.user.id,
      name,
      subject,
      body: templateBody,
      category,
      isDefault,
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Template creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
