import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidPipelineStage, type PipelineKind } from '@/lib/pipelines';

/**
 * Reject status/stage values that are not in the company's configured pipeline.
 * Returns a NextResponse error, or null when the stage is allowed.
 */
export async function rejectIfOutsideCompanyPipeline(
  companyId: string | null | undefined,
  kind: PipelineKind,
  stage: string | null | undefined
): Promise<NextResponse | null> {
  if (!companyId || !stage || typeof stage !== 'string') return null;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });

  if (!isValidPipelineStage(kind, stage, company?.settings)) {
    return NextResponse.json(
      {
        error: `Stage "${stage}" is not enabled in this company's ${kind.replace(/_/g, ' ')} pipeline`,
      },
      { status: 400 }
    );
  }

  return null;
}
