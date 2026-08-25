import { prisma } from '@/lib/prisma';
import { sendWarrantyExpiryAlert } from '@/lib/email/portal-notifications';
import { notifyPortalCustomer } from '@/lib/portal/notify-customer';

const ALERT_DAYS = 30;

export async function runWarrantyExpiryAlerts() {
  const now = new Date();
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + ALERT_DAYS);

  const installations = await prisma.equipmentInstallation.findMany({
    where: {
      status: 'ACTIVE',
      warrantyExpiry: { gte: now, lte: windowEnd },
    },
    select: {
      id: true,
      serialNumber: true,
      warrantyExpiry: true,
      customer: {
        select: {
          id: true,
          email: true,
          contactPerson: true,
          organizationName: true,
        },
      },
      product: { select: { name: true } },
    },
    take: 200,
  });

  let sent = 0;
  let skipped = 0;

  for (const row of installations) {
    if (!row.customer.email || !row.warrantyExpiry) {
      skipped++;
      continue;
    }

    const daysRemaining = Math.max(
      0,
      Math.ceil((row.warrantyExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    const equipmentName = row.product.name;
    const customerName = row.customer.contactPerson || row.customer.organizationName;

    await notifyPortalCustomer({
      customerId: row.customer.id,
      category: 'warrantyAlerts',
      type: 'WARRANTY_EXPIRING',
      title: `Warranty expiring in ${daysRemaining} days`,
      body: `${equipmentName} warranty expires on ${row.warrantyExpiry.toLocaleDateString()}.`,
      metadata: { equipmentId: row.id, daysRemaining },
      email: {
        send: () =>
          sendWarrantyExpiryAlert({
            customerEmail: row.customer.email!,
            customerName,
            equipmentName,
            serialNumber: row.serialNumber,
            warrantyExpiry: row.warrantyExpiry!,
            daysRemaining,
          }),
      },
    });

    sent++;
  }

  return { scanned: installations.length, sent, skipped };
}
