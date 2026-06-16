import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getUserPrimaryCompanyId } from '@/lib/auth/company-membership'
import {
  CompanyRole,
  CompanyStatus,
  EmployeeRole,
  EmployeeStatus,
  UserRole,
} from '@prisma/client'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { buildInitialCompanySettings } from '@/lib/workspace-config'

const bodySchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Use letters, numbers, and single hyphens only'),
})

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
])

function normalizeSlug(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function uniqueDisplayName(slug: string): Promise<string> {
  const base =
    slug
      .split('-')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') || slug
  let name = base
  let n = 0
  while (await prisma.company.findFirst({ where: { name }, select: { id: true } })) {
    n += 1
    name = `${base} (${n})`
  }
  return name
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const json = await req.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid slug' },
        { status: 400 }
      )
    }

    const slug = normalizeSlug(parsed.data.slug)
    if (!slug || slug.length < 2) {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
    }
    if (RESERVED.has(slug)) {
      return NextResponse.json({ error: 'This URL is reserved. Pick another slug.' }, { status: 400 })
    }

    const existingPrimary = await getUserPrimaryCompanyId(userId)
    if (existingPrimary) {
      return NextResponse.json(
        { error: 'Your account is already linked to a workspace.' },
        { status: 400 }
      )
    }

    const existingEmployee = await prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (existingEmployee) {
      return NextResponse.json(
        { error: 'Your account already has an employee profile. Contact support to link a workspace.' },
        { status: 400 }
      )
    }

    const slugTaken = await prisma.company.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (slugTaken) {
      return NextResponse.json(
        { error: 'That workspace URL is already taken. Try a different slug.' },
        { status: 409 }
      )
    }

    const displayName = await uniqueDisplayName(slug)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, role: true },
    })
    if (!user?.email) {
      return NextResponse.json({ error: 'User email missing' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: displayName,
          slug,
          website: null,
          status: CompanyStatus.PENDING,
          settings: buildInitialCompanySettings('general'),
        },
      })

      const employee = await tx.employee.create({
        data: {
          id: randomUUID(),
          employeeId: `ADM${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          name: user.name?.trim() || user.email.split('@')[0] || 'Admin',
          email: user.email,
          phone: '',
          jobTitle: 'Administrator',
          department: 'Administration',
          role: EmployeeRole.ADMIN,
          status: EmployeeStatus.PENDING,
          companyId: company.id,
          userId,
          address: { street: '', city: '', state: '', country: '', zipCode: '' },
          updatedAt: new Date(),
        },
      })

      await tx.company.update({
        where: { id: company.id },
        data: { adminId: employee.id },
      })

      await tx.userCompany.create({
        data: { userId, companyId: company.id },
      })

      await tx.userCompanyRole.create({
        data: {
          userId,
          companyId: company.id,
          role: CompanyRole.ADMIN,
          assignedById: employee.id,
        },
      })

      const nextRole =
        user.role === UserRole.SUPER_ADMIN ? UserRole.SUPER_ADMIN : UserRole.ADMIN

      await tx.user.update({
        where: { id: userId },
        data: {
          primaryCompanyId: company.id,
          companyId: company.id,
          employeeProfile: { connect: { id: employee.id } },
          role: nextRole,
        },
      })

      return { company, employee }
    })

    return NextResponse.json({
      ok: true,
      slug: result.company.slug,
      companyId: result.company.id,
    })
  } catch (e) {
    console.error('[workspace-slug]', e)
    return NextResponse.json({ error: 'Could not save workspace URL' }, { status: 500 })
  }
}
