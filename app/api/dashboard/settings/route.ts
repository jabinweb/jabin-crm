import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { handleRouteError } from '@/lib/api/tenant-response';
import { prisma } from '@/lib/prisma'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'

function deepMergeSettings(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMergeSettings(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      )
    } else {
      result[key] = value
    }
  }
  return result
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const role = (session.user as { role?: string }).role
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req)

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        logo: true,
        email: true,
        phone: true,
        website: true,
        settings: true,
      },
    })

    const response = {
      company: {
        id: company?.id,
        name: company?.name,
        logo: company?.logo,
        email: company?.email,
        phone: company?.phone,
        website: company?.website,
      },
      settings: company?.settings || {},
    }

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof TenantError) {
      return new Response(
        JSON.stringify({
          error: error.message,
          ...(error.code ? { code: error.code } : {}),
        }),
        {
          status: error.status,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
    console.error('[API] Settings error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const role = (session.user as { role?: string }).role
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req)

    const { company: companyData, settings: settingsData } = await req.json()

    const existing = await prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true },
    })

    const mergedSettings =
      settingsData && existing?.settings && typeof existing.settings === 'object' && !Array.isArray(existing.settings)
        ? deepMergeSettings(existing.settings as Record<string, unknown>, settingsData)
        : settingsData ?? existing?.settings

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...(companyData && {
          name: companyData.name,
          logo: companyData.logo,
          email: companyData.email,
          phone: companyData.phone,
          website: companyData.website,
        }),
        ...(settingsData && { settings: mergedSettings }),
      },
      select: {
        id: true,
        name: true,
        logo: true,
        email: true,
        phone: true,
        website: true,
        settings: true,
      },
    })

    const response = {
      company: {
        id: company.id,
        name: company.name,
        logo: company.logo,
        email: company.email,
        phone: company.phone,
        website: company.website,
      },
      settings: company.settings || {},
    }

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof TenantError) {
      return new Response(
        JSON.stringify({
          error: error.message,
          ...(error.code ? { code: error.code } : {}),
        }),
        {
          status: error.status,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
    console.error('[API] Settings update error:', error)
    return new Response(
      JSON.stringify({
        message: error instanceof Error ? error.message : 'Internal Server Error',
      }),
      {
        status: error instanceof Error ? 400 : 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
