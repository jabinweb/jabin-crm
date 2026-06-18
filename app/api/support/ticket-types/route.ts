import { handleRouteError } from '@/lib/api/tenant-response';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';
import { resolveCompanyTicketConfig } from '@/lib/support/resolve-company-ticket-config';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req);
    const { config, ticketTypes, supportSettings } =
      await resolveCompanyTicketConfig(companyId);

    return NextResponse.json({
      ticketTypes,
      terminology: config.terminology,
      supportSettings,
      features: {
        equipment: config.features.equipment,
        products: config.features.products,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json(
        { error: error.message, ...(error.code ? { code: error.code } : {}) },
        { status: error.status }
      );
    }
    console.error('[api/support/ticket-types]', error);
    return NextResponse.json({ error: 'Failed to load ticket types' }, { status: 500 });
  }
}
