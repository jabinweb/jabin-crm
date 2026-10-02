import { prisma } from '@/lib/prisma';
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
    const owned = await prisma.emailSequence.findFirst({
      where: { id: params.id, userId: session.user.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }
    const stats = await sequenceService.getSequenceWithStats(params.id);
    return NextResponse.json(stats);
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error fetching sequence stats:', error);
    }
    return handleApiError(error);
  }
}
