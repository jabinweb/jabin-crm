import type { Session } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { TenantError } from '@/lib/auth/company-membership';
import { assertTicketTenantAccess } from '@/lib/tenant/scope-staff-query';

type GuardResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

/** Validates session + ticket belongs to caller's tenant. */
export async function requireTicketRouteAccess(
  session: Session | null,
  req: NextRequest,
  ticketId: string
): Promise<GuardResult> {
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  try {
    const access = await assertTicketTenantAccess(session, req, ticketId);
    if (!access) {
      return { ok: false, response: NextResponse.json({ error: 'Ticket not found' }, { status: 404 }) };
    }
    return { ok: true, session };
  } catch (error) {
    if (error instanceof TenantError) {
      return {
        ok: false,
        response: NextResponse.json({ error: error.message }, { status: error.status }),
      };
    }
    throw error;
  }
}
