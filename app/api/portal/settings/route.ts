import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  DEFAULT_PORTAL_NOTIFICATION_PREFS,
  getPortalNotificationPrefs,
  savePortalNotificationPrefs,
} from '@/lib/portal/customer-notification-prefs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'CUSTOMER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const notifications = await getPortalNotificationPrefs(session.user.id);
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('[api/portal/settings GET]', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'CUSTOMER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const incoming = body?.notifications;
    if (!incoming || typeof incoming !== 'object') {
      return NextResponse.json({ error: 'notifications object required' }, { status: 400 });
    }

    const notifications = await savePortalNotificationPrefs(session.user.id, {
      ticketUpdates: incoming.ticketUpdates ?? DEFAULT_PORTAL_NOTIFICATION_PREFS.ticketUpdates,
      warrantyAlerts: incoming.warrantyAlerts ?? DEFAULT_PORTAL_NOTIFICATION_PREFS.warrantyAlerts,
      maintenanceReminders:
        incoming.maintenanceReminders ?? DEFAULT_PORTAL_NOTIFICATION_PREFS.maintenanceReminders,
      newsUpdates: incoming.newsUpdates ?? DEFAULT_PORTAL_NOTIFICATION_PREFS.newsUpdates,
      emailEnabled: incoming.emailEnabled ?? DEFAULT_PORTAL_NOTIFICATION_PREFS.emailEnabled,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('[api/portal/settings PATCH]', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
