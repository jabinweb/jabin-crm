import { NextRequest, NextResponse } from 'next/server';
import { sequenceService } from '@/lib/crm/sequence-service';
import { handleApiError } from '@/lib/api-error-handler';
import { withModuleAccess } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');

    const params = await context.params;
    const sequence = await sequenceService.getSequenceWithStats(params.id);

    if (!sequence || sequence.userId !== session.user.id) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    return NextResponse.json(sequence);
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error fetching sequence:', error);
    }
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await withModuleAccess('EMAIL_OUTREACH');

    const params = await context.params;
    const body = await req.json();
    const { name, description, steps } = body;

    const sequence = await sequenceService.updateSequence(params.id, {
      name,
      description,
      steps,
    });

    return NextResponse.json(sequence);
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error updating sequence:', error);
    }
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await withModuleAccess('EMAIL_OUTREACH');

    const params = await context.params;
    await sequenceService.deleteSequence(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error deleting sequence:', error);
    }
    return handleApiError(error);
  }
}
