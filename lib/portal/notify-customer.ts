import { notificationService } from '@/lib/crm/notification-service';
import type { NotificationType } from '@prisma/client';
import {
  shouldSendPortalEmail,
  shouldSendPortalInApp,
  type PortalNotificationCategory,
} from '@/lib/portal/customer-notification-prefs';

type NotifyCustomerParams = {
  customerId: string;
  category: PortalNotificationCategory;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  email?: {
    send: () => Promise<unknown>;
  };
};

/** In-app + optional email for portal customers, respecting saved preferences. */
export async function notifyPortalCustomer(params: NotifyCustomerParams) {
  const { customerId, category, type, title, body, metadata, email } = params;

  const inApp = await shouldSendPortalInApp(customerId, category);
  if (inApp.ok && inApp.userId) {
    void notificationService
      .create({
        type,
        title,
        body,
        customerId,
        metadata,
      })
      .catch((err) => console.error('[notifyPortalCustomer.inApp]', err));
  }

  if (email) {
    const mail = await shouldSendPortalEmail(customerId, category);
    if (mail.ok && mail.user) {
      void email.send().catch((err) => console.error('[notifyPortalCustomer.email]', err));
    }
  }
}
