import { prisma } from '@/lib/prisma';
import { workspaceStaffWhere } from '@/lib/auth/workspace-staff';

/**
 * Ensure ids referenced by a demo unit write belong to the workspace.
 * Returns an error message, or null when every provided id is valid.
 */
export async function validateDemoUnitRefs(
  companyId: string,
  refs: {
    productId?: unknown;
    locationId?: unknown;
    customerId?: unknown;
    custodianUserId?: unknown;
  }
): Promise<string | null> {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const productId = str(refs.productId);
  const locationId = str(refs.locationId);
  const customerId = str(refs.customerId);
  const custodianUserId = str(refs.custodianUserId);

  if (productId) {
    const ok = await prisma.product.findFirst({ where: { id: productId, companyId }, select: { id: true } });
    if (!ok) return 'Product not found';
  }
  if (locationId) {
    const ok = await prisma.location.findFirst({ where: { id: locationId, companyId }, select: { id: true } });
    if (!ok) return 'Location not found';
  }
  if (customerId) {
    const ok = await prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true } });
    if (!ok) return 'Customer not found';
  }
  if (custodianUserId) {
    const ok = await prisma.user.findFirst({
      where: { id: custodianUserId, ...workspaceStaffWhere(companyId) },
      select: { id: true },
    });
    if (!ok) return 'Custodian not found';
  }
  return null;
}
