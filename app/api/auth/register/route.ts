import { NextResponse } from 'next/server'
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
import type { PrismaClient } from '@prisma/client'
import { buildInitialCompanySettings } from '@/lib/workspace-config'
import { isBusinessVertical, type BusinessVertical } from '@/lib/workspace-templates'
import { seedCompanySupportDesk } from '@/lib/support/seed-company-support'

type RegisterTransactionClient = Pick<
  PrismaClient,
  'company' | 'employee' | 'user'
>

function slugFromName(name: string): string {
  const base = String(name || 'company')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return base || 'company'
}

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  companyName: z.string().min(2).max(100),
  website: z.string().url().max(255),
  businessVertical: z
    .string()
    .optional()
    .refine((v) => !v || isBusinessVertical(v), 'Invalid business type'),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const data = registerSchema.parse(body)

    // Check for existing email
    const [existingUser, existingCompanyWebsite] = await Promise.all([
      prisma.user.findUnique({ where: { email: data.email } }),
      prisma.company.findUnique({ where: { website: data.website } })
    ])

    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    if (existingCompanyWebsite) {
      return NextResponse.json({ error: 'Company website already registered' }, { status: 400 })
    }

    // Create records in transaction
    const result = await prisma.$transaction(async (tx: RegisterTransactionClient) => {
      const vertical = isBusinessVertical(data.businessVertical)
        ? data.businessVertical
        : 'general'

      // Create company first
      const company = await tx.company.create({
        data: {
          name: data.companyName,
          slug: `${slugFromName(data.companyName)}-${randomUUID().slice(0, 8)}`,
          website: data.website,
          status: CompanyStatus.PENDING,
          settings: buildInitialCompanySettings(vertical),
        },
      })

      // Create admin employee
      const employee = await tx.employee.create({
        data: {
          id: randomUUID(),
          employeeId: `ADM${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          name: data.name,
          email: data.email,
          phone: '',
          jobTitle: 'Administrator',
          department: 'Administration',
          role: EmployeeRole.ADMIN,
          status: EmployeeStatus.PENDING,
          companyId: company.id,
          address: { street: '', city: '', state: '', country: '', zipCode: '' },
          updatedAt: new Date()
        }
      })

      // Create user with hashed password
      const hashedPassword = await bcrypt.hash(data.password, 12)
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: hashedPassword,
          role: UserRole.ADMIN,
          userStatus: UserStatus.PENDING,
          primaryCompanyId: company.id,
          companyId: company.id,
          employeeProfile: {
            connect: { id: employee.id },
          },
          userCompanies: {
            create: {
              companyId: company.id,
            },
          },
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

    seedCompanySupportDesk(
      result.company.id,
      result.vertical as BusinessVertical
    ).catch((err) => console.error('[register] support desk seed failed:', err))

    return NextResponse.json({
      success: true,
      message: 'Registration successful. Please wait for admin approval.',
      data: {
        userId: result.user.id,
        companyId: result.company.id
      }
    })
  } catch (error) {
    console.error('Registration error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}

