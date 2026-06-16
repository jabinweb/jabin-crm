import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';

export async function POST(request: NextRequest) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    }

    await prisma.emailDraft.deleteMany({
      where: { id: { in: ids }, userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error bulk deleting drafts:', error);
    return NextResponse.json({ error: 'Failed to delete drafts' }, { status: 500 });
  }
}
