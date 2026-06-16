import { NextRequest, NextResponse } from 'next/server';
import { sequenceService } from '@/lib/crm/sequence-service';
import { handleApiError } from '@/lib/api-error-handler';
import { withModuleAccess } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';

export async function GET(req: NextRequest) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');

    const sequences = await sequenceService.getUserSequences(session.user.id);
    return NextResponse.json(sequences);
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error fetching sequences:', error);
    }
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');

    const body = await req.json();
    const { name, description, steps } = body;

    if (!name || !steps || !Array.isArray(steps)) {
      return NextResponse.json(
        { error: 'Name and steps are required' },
        { status: 400 }
      );
    }

    const sequence = await sequenceService.createSequence(session.user.id, {
      name,
      description,
      steps,
    });

    return NextResponse.json(sequence, { status: 201 });
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error creating sequence:', error);
    }
    return handleApiError(error);
  }
}
