import { NextResponse } from 'next/server';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  trigger: z.string().optional(),
  conditions: z.unknown().optional(),
  actions: z.unknown().optional(),
  isActive: z.boolean().optional(),
});

export const GET = withSessionRoute(async (_req, { userId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const workflow = await prisma.workflow.findFirst({
    where: { id, userId },
    include: {
      executions: { orderBy: { executedAt: 'desc' }, take: 20 },
    },
  });
  if (!workflow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return jsonOk(workflow);
});

export const PATCH = withSessionRoute(async (req, { userId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const body = patchSchema.parse(await req.json());
  const existing = await prisma.workflow.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const workflow = await prisma.workflow.update({
    where: { id },
    data: {
      ...body,
      conditions:
        body.conditions !== undefined ? (body.conditions as object) : undefined,
      actions: body.actions !== undefined ? (body.actions as object) : undefined,
    },
  });
  return jsonOk(workflow);
});

export const DELETE = withSessionRoute(async (_req, { userId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const existing = await prisma.workflow.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await prisma.workflow.delete({ where: { id } });
  return jsonOk({ success: true });
});
