import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  displayName: z.string().min(1).max(120).optional(),
  description: z.string().nullable().optional(),
  price: z.number().int().nonnegative().optional(),
  currency: z.string().min(1).max(8).optional(),
  interval: z.string().min(1).max(32).optional(),
  maxLeads: z.number().int().nonnegative().optional(),
  maxEmails: z.number().int().nonnegative().optional(),
  maxCampaigns: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  features: z.array(z.unknown()).optional(),
  modules: z.record(z.boolean()).optional(),
})

async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== UserRole.SUPER_ADMIN) {
    return null
  }
  return session
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ planId: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId } = await ctx.params
  if (!planId) {
    return NextResponse.json({ error: 'Missing plan id' }, { status: 400 })
  }

  try {
    const json = await req.json()
    const parsed = patchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid body' },
        { status: 400 }
      )
    }
    const d = parsed.data
    const data: Record<string, unknown> = {}
    if (d.name !== undefined) data.name = d.name.trim().toLowerCase().replace(/\s+/g, '-')
    if (d.displayName !== undefined) data.displayName = d.displayName.trim()
    if (d.description !== undefined) data.description = d.description
    if (d.price !== undefined) data.price = d.price
    if (d.currency !== undefined) data.currency = d.currency
    if (d.interval !== undefined) data.interval = d.interval
    if (d.maxLeads !== undefined) data.maxLeads = d.maxLeads
    if (d.maxEmails !== undefined) data.maxEmails = d.maxEmails
    if (d.maxCampaigns !== undefined) data.maxCampaigns = d.maxCampaigns
    if (d.isActive !== undefined) data.isActive = d.isActive
    if (d.features !== undefined) data.features = d.features as object
    if (d.modules !== undefined) data.modules = d.modules as object

    const plan = await prisma.plan.update({
      where: { id: planId },
      data: data as any,
      include: {
        _count: { select: { subscriptions: true } },
      },
    })
    return NextResponse.json(plan)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('Record to update not found')) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'A plan with this name already exists' }, { status: 409 })
    }
    console.error('[admin/plans] PATCH', e)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ planId: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId } = await ctx.params
  if (!planId) {
    return NextResponse.json({ error: 'Missing plan id' }, { status: 400 })
  }

  try {
    const count = await prisma.subscription.count({ where: { planId } })
    if (count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a plan that has active subscriptions' },
        { status: 400 }
      )
    }
    await prisma.plan.delete({ where: { id: planId } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('Record to delete does not exist')) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }
    console.error('[admin/plans] DELETE', e)
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
  }
}
