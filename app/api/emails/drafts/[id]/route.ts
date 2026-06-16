import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');
    const { id } = await context.params;

    const draft = await prisma.emailDraft.findUnique({ where: { id } });
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }
    if (draft.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await prisma.emailDraft.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error deleting email draft:', error);
    return NextResponse.json({ error: 'Failed to delete email draft' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');
    const { id } = await context.params;
    const body = await request.json();
    const { subject, emailBody, status } = body;

    const draft = await prisma.emailDraft.findUnique({ where: { id } });
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }
    if (draft.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updatedDraft = await prisma.emailDraft.update({
      where: { id },
      data: {
        ...(subject && { subject }),
        ...(emailBody && { body: emailBody }),
        ...(status && { status }),
      },
    });

    return NextResponse.json({ draft: updatedDraft });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error updating email draft:', error);
    return NextResponse.json({ error: 'Failed to update email draft' }, { status: 500 });
  }
}
