import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';
import { prisma } from '@/lib/prisma';
import { resolveCompanyIntegrationStatuses } from '@/lib/integrations/resolve-company-status';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const role = (session.user as { role?: string }).role;
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req);

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true },
    });

    const integrations = await resolveCompanyIntegrationStatuses({
      companyId,
      companySettings: company?.settings ?? {},
      viewerUserId: session.user.id,
    });

    return new Response(JSON.stringify({ integrations }), {
      headers: { 'Content-Type': 'application/json' },
    });
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
      );
    }
    console.error('[API] Integrations status error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
