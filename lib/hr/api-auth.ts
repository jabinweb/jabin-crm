import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { hasLegacyRole } from '@/lib/auth/permissions'
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership'
import { asNextRequest } from '@/lib/api/as-next-request'

export type HrAdminContext = {
  session: Session
  companyId: string
}

/** Admin/SUPER_ADMIN + tenant company scope for HR APIs. */
export async function requireHrAdmin(
  request: Request
): Promise<HrAdminContext | { error: NextResponse }> {
  const session = await auth()
  if (!session?.user || !hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  try {
    const { companyId } = await resolveCompanyContextFromRequest(
      session,
      asNextRequest(request)
    )
    return { session, companyId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No company context'
    const status =
      typeof (error as { status?: number })?.status === 'number'
        ? (error as { status: number }).status
        : 400
    return { error: NextResponse.json({ error: message }, { status }) }
  }
}

export function isHrAdminResult(
  value: HrAdminContext | { error: NextResponse }
): value is { error: NextResponse } {
  return 'error' in value
}
