import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import {
  UserRole,
  UserStatus,
  CompanyStatus,
  EmployeeRole,
  EmployeeStatus,
  CompanyRole,
} from '@prisma/client'
import { buildInitialCompanySettings } from '@/lib/workspace-config'
import { isBusinessVertical, type BusinessVertical } from '@/lib/workspace-templates'
import { seedCompanySupportDesk } from '@/lib/support/seed-company-support'
import { initialOnboardingState } from '@/lib/onboarding/company-onboarding'
import { ensureFreeTrialSubscription } from '@/lib/subscription/ensure-free-trial'

const RESERVED = new Set([
  'api',
  'auth',
  'register',
  'login',
  'signin',
  'signout',
  'dashboard',
  'employee',
  'admin',
  'portal',
  'static',
  'icons',
  '_next',
  'monitoring',
  'start',
  'pricing',
  'workspace',
  'opslane',
])

export function normalizeWorkspaceSlug(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const startSchema = z.object({
  companyName: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Use letters, numbers, and single hyphens only'),
  businessVertical: z
    .string()
    .refine((v) => isBusinessVertical(v), 'Invalid industry'),
  country: z.string().min(2).max(2).optional(),
  teamSize: z.enum(['1-10', '11-35', '36-100', '100+']).optional(),
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must include upper, lower, and a number'
    ),
})

/** GET ?slug=acme — availability check for step 1 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('slug') || ''
  const slug = normalizeWorkspaceSlug(raw)
  if (!slug || slug.length < 2) {
    return NextResponse.json({ available: false, error: 'Enter a longer workspace URL' })
  }
  if (RESERVED.has(slug)) {
    return NextResponse.json({ available: false, error: 'This URL is reserved' })
  }
  const taken = await prisma.company.findUnique({
    where: { slug },
    select: { id: true },
  })
  return NextResponse.json({
    available: !taken,
    slug,
    error: taken ? 'That workspace URL is taken' : null,
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = startSchema.parse(body)
    const slug = normalizeWorkspaceSlug(data.slug)

    if (!slug || slug.length < 2 || RESERVED.has(slug)) {
      return NextResponse.json({ error: 'Invalid workspace URL' }, { status: 400 })
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: data.email, mode: 'insensitive' } },
      select: { id: true },
    })
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    const slugTaken = await prisma.company.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (slugTaken) {
      return NextResponse.json({ error: 'That workspace URL is taken' }, { status: 409 })
    }

    const vertical = data.businessVertical as BusinessVertical
    const settings = {
      ...buildInitialCompanySettings(vertical),
      onboarding: initialOnboardingState(),
      start: {
        country: data.country?.toUpperCase() || null,
        teamSize: data.teamSize || null,
        source: 'opslane-start',
      },
    }

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: data.companyName.trim(),
          slug,
          website: null,
          status: CompanyStatus.APPROVED,
          settings,
        },
      })

      const employee = await tx.employee.create({
        data: {
          id: randomUUID(),
          employeeId: `ADM${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          name: data.name.trim(),
          email: data.email,
          phone: '',
          jobTitle: 'Administrator',
          department: 'Administration',
          role: EmployeeRole.ADMIN,
          status: EmployeeStatus.ACTIVE,
          companyId: company.id,
          address: {
            street: '',
            city: '',
            state: '',
            country: data.country?.toUpperCase() || '',
            zipCode: '',
          },
          updatedAt: new Date(),
        },
      })

      await tx.company.update({
        where: { id: company.id },
        data: { adminId: employee.id },
      })

      const hashedPassword = await bcrypt.hash(data.password, 12)
      const user = await tx.user.create({
        data: {
          name: data.name.trim(),
          email: data.email,
          password: hashedPassword,
          role: UserRole.ADMIN,
          userStatus: UserStatus.ACTIVE,
          primaryCompanyId: company.id,
          companyId: company.id,
          employeeProfile: { connect: { id: employee.id } },
          userCompanies: { create: { companyId: company.id } },
          companyRoles: {
            create: {
              companyId: company.id,
              role: CompanyRole.ADMIN,
              assignedById: employee.id,
            },
          },
        },
      })

      return { user, company, employee, vertical }
    })

    seedCompanySupportDesk(result.company.id, result.vertical).catch((err) =>
      console.error('[start] support desk seed failed:', err)
    )

    try {
      await ensureFreeTrialSubscription(result.user.id)
    } catch (err) {
      console.error('[start] free trial subscription failed:', err)
    }

    return NextResponse.json({
      success: true,
      companySlug: result.company.slug,
      email: result.user.email,
      country: data.country?.toUpperCase() || null,
    })
  } catch (error) {
    console.error('[api/auth/start]', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Could not create workspace' }, { status: 500 })
  }
}
