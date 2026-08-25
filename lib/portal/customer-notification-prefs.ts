import { prisma } from '@/lib/prisma';

export type PortalNotificationCategory =
  | 'ticketUpdates'
  | 'warrantyAlerts'
  | 'maintenanceReminders'
  | 'newsUpdates';

export type PortalNotificationPrefs = {
  ticketUpdates: boolean;
  warrantyAlerts: boolean;
  maintenanceReminders: boolean;
  newsUpdates: boolean;
  emailEnabled: boolean;
};

export const DEFAULT_PORTAL_NOTIFICATION_PREFS: PortalNotificationPrefs = {
  ticketUpdates: true,
  warrantyAlerts: true,
  maintenanceReminders: true,
  newsUpdates: false,
  emailEnabled: true,
};

function parsePortalPrefs(raw: unknown): PortalNotificationPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PORTAL_NOTIFICATION_PREFS };
  const portal = (raw as { portal?: Partial<PortalNotificationPrefs> }).portal;
  if (!portal || typeof portal !== 'object') return { ...DEFAULT_PORTAL_NOTIFICATION_PREFS };
  return {
    ticketUpdates: portal.ticketUpdates ?? DEFAULT_PORTAL_NOTIFICATION_PREFS.ticketUpdates,
    warrantyAlerts: portal.warrantyAlerts ?? DEFAULT_PORTAL_NOTIFICATION_PREFS.warrantyAlerts,
    maintenanceReminders:
      portal.maintenanceReminders ?? DEFAULT_PORTAL_NOTIFICATION_PREFS.maintenanceReminders,
    newsUpdates: portal.newsUpdates ?? DEFAULT_PORTAL_NOTIFICATION_PREFS.newsUpdates,
    emailEnabled: portal.emailEnabled ?? DEFAULT_PORTAL_NOTIFICATION_PREFS.emailEnabled,
  };
}

export async function getPortalNotificationPrefs(userId: string): Promise<PortalNotificationPrefs> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { notifications: true },
  });
  return parsePortalPrefs(settings?.notifications);
}

export async function savePortalNotificationPrefs(
  userId: string,
  prefs: Partial<PortalNotificationPrefs>
): Promise<PortalNotificationPrefs> {
  const existing = await prisma.userSettings.findUnique({
    where: { userId },
    select: { notifications: true, theme: true, language: true },
  });

  const currentNotifications =
    existing?.notifications && typeof existing.notifications === 'object'
      ? (existing.notifications as Record<string, unknown>)
      : {};

  const merged = {
    ...DEFAULT_PORTAL_NOTIFICATION_PREFS,
    ...parsePortalPrefs(currentNotifications),
    ...prefs,
  };

  const notifications = {
    ...currentNotifications,
    portal: merged,
  };

  await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      notifications,
      theme: existing?.theme ?? 'system',
      language: existing?.language ?? 'en',
    },
    update: { notifications },
  });

  return merged;
}

export async function getPortalUserForCustomer(customerId: string) {
  return prisma.user.findFirst({
    where: { customerId, role: 'CUSTOMER', userStatus: 'ACTIVE' },
    select: { id: true, email: true, name: true, customerId: true },
  });
}

export async function shouldSendPortalEmail(
  customerId: string,
  category: PortalNotificationCategory
): Promise<{ ok: boolean; user: { id: string; email: string; name: string | null } | null }> {
  const user = await getPortalUserForCustomer(customerId);
  if (!user?.email) return { ok: false, user: null };
  const prefs = await getPortalNotificationPrefs(user.id);
  if (!prefs.emailEnabled) return { ok: false, user };
  return { ok: prefs[category] === true, user };
}

export async function shouldSendPortalInApp(
  customerId: string,
  category: PortalNotificationCategory
): Promise<{ ok: boolean; userId: string | null }> {
  const user = await getPortalUserForCustomer(customerId);
  if (!user) return { ok: false, userId: null };
  const prefs = await getPortalNotificationPrefs(user.id);
  return { ok: prefs[category] === true, userId: user.id };
}
