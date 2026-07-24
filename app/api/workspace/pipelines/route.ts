import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import {
  ALL_PIPELINE_KINDS,
  PIPELINE_DEFS,
  PIPELINE_KIND_LABELS,
  parsePipelines,
  resolvePipelineStages,
  sanitizePipelinePatch,
  type PipelineKind,
} from '@/lib/pipelines';

function asSettingsObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export const GET = withTenantRoute(async (_request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN', 'SALES', 'SUPPORT_MANAGER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });

  const pipelines = parsePipelines(company?.settings);
  const resolved = ALL_PIPELINE_KINDS.reduce(
    (acc, kind) => {
      acc[kind] = {
        stages: pipelines[kind].stages,
        columns: resolvePipelineStages(kind, company?.settings),
        available: PIPELINE_DEFS[kind],
        label: PIPELINE_KIND_LABELS[kind],
      };
      return acc;
    },
    {} as Record<
      PipelineKind,
      {
        stages: string[];
        columns: ReturnType<typeof resolvePipelineStages>;
        available: (typeof PIPELINE_DEFS)[PipelineKind];
        label: string;
      }
    >
  );

  return jsonOk({ pipelines: resolved });
});

export const PATCH = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const kind = body.kind as PipelineKind;
  if (!ALL_PIPELINE_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Invalid pipeline kind' }, { status: 400 });
  }

  const stages = sanitizePipelinePatch(kind, body.stages);
  if (!stages) {
    return NextResponse.json(
      { error: 'stages must be a non-empty array of valid enum values' },
      { status: 400 }
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  const settings = asSettingsObject(company?.settings);
  const pipelinesRaw =
    settings.pipelines && typeof settings.pipelines === 'object' && !Array.isArray(settings.pipelines)
      ? { ...(settings.pipelines as Record<string, unknown>) }
      : {};
  pipelinesRaw[kind] = { stages };
  settings.pipelines = pipelinesRaw;

  await prisma.company.update({
    where: { id: companyId },
    data: { settings: settings as Prisma.InputJsonValue },
  });

  return jsonOk({
    kind,
    stages,
    columns: resolvePipelineStages(kind, settings),
  });
});
