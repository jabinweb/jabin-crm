import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTenantRoute, jsonOk } from '@/lib/api/with-route'
import { hasLegacyRole } from '@/lib/auth/permissions'
import {
  DEFAULT_BUSINESS_HOURS,
  parseBusinessHoursFromSettings,
} from '@/lib/crm/business-hours'

export const GET = withTenantRoute(async (_request, { companyId }) => {
  const company = await prisma.company.findUnique({
    where: { id: companyId! },
    select: { settings: true },
  })
  return jsonOk(parseBusinessHoursFromSettings(company?.settings))
})

export const PUT = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const company = await prisma.company.findUnique({
    where: { id: companyId! },
    select: { settings: true },
  })
  const current =
    company?.settings && typeof company.settings === 'object' && !Array.isArray(company.settings)
      ? { ...(company.settings as Record<string, unknown>) }
      : {}
  const businessHours = {
    ...DEFAULT_BUSINESS_HOURS,
    ...parseBusinessHoursFromSettings(current),
    ...body,
    weekly: {
      ...DEFAULT_BUSINESS_HOURS.weekly,
      ...(body.weekly || {}),
    },
  }
  await prisma.company.update({
    where: { id: companyId! },
    data: { settings: { ...current, businessHours } },
  })
  return jsonOk(businessHours)
})
