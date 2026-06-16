import { NextRequest, NextResponse } from 'next/server';
import { templateService } from '@/lib/email/template-service';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';

export async function GET(request: NextRequest) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');
    const categories = await templateService.getCategories(session.user.id);
    return NextResponse.json(categories);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Categories fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
