import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolvePortalDataAccess } from '@/lib/api/portal-access';
import { prisma } from '@/lib/prisma';
import { resolveCompanyTicketConfig } from '@/lib/support/resolve-company-ticket-config';

export async function GET() {
  try {
    const session = await auth();
    // Staff previewing the portal see their own workspace's configuration
    const staffPreview = resolvePortalDataAccess(session);
    const staffCompanyId =
      staffPreview.ok && staffPreview.scope === 'staff' ? session?.user?.companyId ?? null : null;
    if (!session?.user?.customerId && !staffCompanyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customer = staffCompanyId
      ? { companyId: staffCompanyId }
      : await prisma.customer.findUnique({
          where: { id: session!.user!.customerId! },
          select: { companyId: true },
        });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const { config, ticketTypes, supportSettings } = await resolveCompanyTicketConfig(customer.companyId);

    return NextResponse.json({
      ticketTypes,
      terminology: config.terminology,
      features: {
        equipment: config.features.equipment,
        products: config.features.products,
      },
      channels: supportSettings?.channels ?? {},
    });
  } catch (error) {
    console.error('[api/portal/ticket-types]', error);
    return NextResponse.json({ error: 'Failed to load ticket types' }, { status: 500 });
  }
}
