import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { z } from 'zod'

const planBodySchema = z.object({
  name: z.string().min(1).max(64),
  displayName: z.string().min(1).max(120),
  description: z.string().nullable().optional(),
  price: z.number().int().nonnegative(),
  currency: z.string().min(1).max(8).default('INR'),
  interval: z.string().min(1).max(32),
  maxLeads: z.number().int().nonnegative(),
  maxEmails: z.number().int().nonnegative(),
  maxCampaigns: z.number().int().nonnegative(),
  isActive: z.boolean(),
  features: z.array(z.unknown()).optional().default([]),
  modules: z.record(z.boolean()).optional(),
})

async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== UserRole.SUPER_ADMIN) {
    return null
  }
  return session
}

export async function GET() {
  const session = await requireSuperAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const plans = await prisma.plan.findMany({
      orderBy: { price: 'asc' },
      include: {
        _count: { select: { subscriptions: true } },
      },
    })
    return NextResponse.json(plans)
  } catch (e) {
    console.error('[admin/plans] GET', e)
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await requireSuperAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const json = await req.json()
    const parsed = planBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid body' },
        { status: 400 }
      )
    }
    const d = parsed.data
    const plan = await prisma.plan.create({
      data: {
        name: d.name.trim().toLowerCase().replace(/\s+/g, '-'),
        displayName: d.displayName.trim(),
        description: d.description ?? null,
        price: d.price,
        currency: d.currency,
        interval: d.interval,
        maxLeads: d.maxLeads,
        maxEmails: d.maxEmails,
        maxCampaigns: d.maxCampaigns,
        isActive: d.isActive,
        features: d.features as object,
        modules: d.modules as object | undefined,
      },
      include: {
        _count: { select: { subscriptions: true } },
      },
    })
    return NextResponse.json(plan)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Create failed'
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'A plan with this name already exists' }, { status: 409 })
    }
    console.error('[admin/plans] POST', e)
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 })
  }
}
