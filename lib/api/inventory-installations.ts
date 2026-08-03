import { NextRequest, NextResponse } from 'next/server';
import { productService, type CreateInstallationData } from '@/lib/crm/product-service';
import { hasLegacyRole } from '@/lib/auth/permissions';
import type { Session } from 'next-auth';

export async function listCustomerInstallations(
  request: NextRequest,
  companyId?: string
) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');
  const status = searchParams.get('status') || undefined;
  const warrantyExpiring = searchParams.get('warrantyExpiring');
  const hasContract = searchParams.get('hasContract');

  if (customerId) {
    const installations = await productService.getCustomerEquipment(customerId);
    return NextResponse.json(installations);
  }

  if (!companyId) {
    return NextResponse.json({ error: 'Customer ID or company context is required' }, { status: 400 });
  }

  const installations = await productService.getCompanyEquipment(companyId, {
    status,
    warrantyExpiringDays: warrantyExpiring ? Number(warrantyExpiring) : undefined,
    hasContract:
      hasContract === '1' || hasContract === 'true'
        ? true
        : hasContract === '0' || hasContract === 'false'
          ? false
          : undefined,
  });
  return NextResponse.json(installations);
}

export async function createCustomerInstallation(
  session: Session,
  body: Record<string, unknown>
) {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN', 'SALES', 'SUPPORT_MANAGER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!body.productId || !body.customerId) {
    return NextResponse.json(
      { error: 'Product ID and Customer ID are required' },
      { status: 400 }
    );
  }

  const installation = await productService.installEquipment({
    productId: String(body.productId),
    customerId: String(body.customerId),
    serialNumber: typeof body.serialNumber === 'string' ? body.serialNumber : undefined,
    installationDate:
      body.installationDate instanceof Date
        ? body.installationDate
        : typeof body.installationDate === 'string'
          ? new Date(body.installationDate)
          : undefined,
    warrantyExpiry:
      body.warrantyExpiry instanceof Date
        ? body.warrantyExpiry
        : typeof body.warrantyExpiry === 'string'
          ? new Date(body.warrantyExpiry)
          : undefined,
    status: body.status as CreateInstallationData['status'],
    notes: typeof body.notes === 'string' ? body.notes : undefined,
  });
  return NextResponse.json(installation, { status: 201 });
}
