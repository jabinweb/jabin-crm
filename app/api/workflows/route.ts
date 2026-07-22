import { withSessionRoute, jsonOk } from '@/lib/api/with-route';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().optional().nullable(),
  trigger: z.string().min(1).max(80).default('manual'),
  conditions: z.unknown().optional(),
  actions: z.unknown().optional(),
  isActive: z.boolean().optional(),
});

export const GET = withSessionRoute(async (_req, { userId }) => {
  const workflows = await prisma.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { executions: true } },
    },
  });
  return jsonOk({ workflows });
});

export const POST = withSessionRoute(async (req, { userId }) => {
  const body = createSchema.parse(await req.json());
  const workflow = await prisma.workflow.create({
    data: {
      userId,
      name: body.name,
      description: body.description ?? null,
      trigger: body.trigger,
      conditions: (body.conditions as object) ?? {},
      actions: (body.actions as object) ?? {},
      isActive: body.isActive ?? true,
    },
  });
  return jsonOk(workflow, { status: 201 });
});
