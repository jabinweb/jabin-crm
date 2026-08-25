import { prisma } from '@/lib/prisma';
import { INTEGRATION_CATALOG } from '@/lib/integrations/catalog';
import type {
  CompanyWebhooksIntegration,
  IntegrationStatus,
  IntegrationStatusRow,
} from '@/lib/integrations/types';
import { resolveCompanyRazorpaySettings } from '@/lib/razorpay';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const;

function statusLabel(status: IntegrationStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'configured':
      return 'Configured';
    case 'disabled':
      return 'Not configured';
    case 'unavailable':
      return 'Unavailable on plan';
  }
}

function parseWebhooks(raw: unknown): CompanyWebhooksIntegration {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { enabled: false, subscriptions: [] };
  }
  const obj = raw as Record<string, unknown>;
  const subscriptions = Array.isArray(obj.subscriptions)
    ? obj.subscriptions
        .filter((s) => s && typeof s === 'object')
        .map((s) => {
          const row = s as Record<string, unknown>;
          return {
            id: typeof row.id === 'string' ? row.id : crypto.randomUUID(),
            name: typeof row.name === 'string' ? row.name : 'Webhook',
            url: typeof row.url === 'string' ? row.url : '',
            events: Array.isArray(row.events)
              ? row.events.filter((e): e is string => typeof e === 'string')
              : [],
            enabled: row.enabled !== false,
          };
        })
    : [];
  return {
    enabled: obj.enabled === true,
    signingSecret: typeof obj.signingSecret === 'string' ? obj.signingSecret : undefined,
    subscriptions,
  };
}

async function adminUserIds(companyId: string): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { companyId, role: { in: [...ADMIN_ROLES] } },
    select: { id: true },
  });
  return admins.map((u) => u.id);
}

async function resolveWhatsAppStatus(
  adminIds: string[]
): Promise<{ status: IntegrationStatus; detail?: string }> {
  if (!adminIds.length) {
    return { status: 'disabled', detail: 'No workspace admin found' };
  }
  const config = await prisma.whatsAppProviderConfig.findFirst({
    where: {
      userId: { in: adminIds },
      isActive: true,
      provider: { not: 'DISABLED' },
    },
    select: { provider: true },
  });
  if (!config) {
    return { status: 'disabled' };
  }
  return {
    status: 'connected',
    detail: `Provider: ${config.provider.replace(/_/g, ' ')}`,
  };
}

async function resolveEmailStatus(
  adminIds: string[]
): Promise<{ status: IntegrationStatus; detail?: string }> {
  if (!adminIds.length) {
    return { status: 'disabled' };
  }
  const profile = await prisma.userProfile.findFirst({
    where: {
      userId: { in: adminIds },
      smtpHost: { not: null },
      NOT: { smtpHost: '' },
    },
    select: { smtpHost: true, smtpFrom: true, companyEmail: true },
  });
  if (!profile?.smtpHost) {
    return { status: 'disabled' };
  }
  return {
    status: 'configured',
    detail: profile.smtpFrom || profile.companyEmail || profile.smtpHost,
  };
}

async function resolveCalendarStatus(
  adminIds: string[]
): Promise<{ status: IntegrationStatus; detail?: string }> {
  if (!adminIds.length) {
    return { status: 'disabled' };
  }
  const account = await prisma.account.findFirst({
    where: {
      userId: { in: adminIds },
      provider: 'google',
      refresh_token: { not: null },
    },
    select: { scope: true },
  });
  if (!account) {
    return { status: 'disabled' };
  }
  const hasCalendar =
    typeof account.scope === 'string' &&
    (account.scope.includes('calendar') || account.scope.includes('Calendar'));
  return {
    status: hasCalendar ? 'connected' : 'configured',
    detail: hasCalendar ? 'Google account linked' : 'Google sign-in linked',
  };
}

async function isModuleEnabledForViewer(userId: string, module: string): Promise<boolean> {
  try {
    const { isFeatureEnabled } = await import('@/lib/feature-modules');
    return await isFeatureEnabled(userId, module as import('@/lib/feature-module-keys').FeatureModuleKey);
  } catch {
    return true;
  }
}

export async function resolveCompanyIntegrationStatuses(input: {
  companyId: string;
  companySettings: unknown;
  viewerUserId: string;
}): Promise<IntegrationStatusRow[]> {
  const { companyId, companySettings, viewerUserId } = input;
  const adminIds = await adminUserIds(companyId);
  const razorpay = resolveCompanyRazorpaySettings(companySettings);
  const webhooksRoot =
    companySettings &&
    typeof companySettings === 'object' &&
    !Array.isArray(companySettings)
      ? (companySettings as Record<string, unknown>).integrations
      : null;
  const webhooks = parseWebhooks(
    webhooksRoot &&
      typeof webhooksRoot === 'object' &&
      !Array.isArray(webhooksRoot)
      ? (webhooksRoot as Record<string, unknown>).webhooks
      : null
  );

  const [whatsapp, email, calendar] = await Promise.all([
    resolveWhatsAppStatus(adminIds),
    resolveEmailStatus(adminIds),
    resolveCalendarStatus(adminIds),
  ]);

  const rows: IntegrationStatusRow[] = [];

  for (const entry of INTEGRATION_CATALOG) {
    let status: IntegrationStatus = 'disabled';
    let detail: string | undefined;

    if (entry.featureModule) {
      const enabled = await isModuleEnabledForViewer(viewerUserId, entry.featureModule);
      if (!enabled) {
        rows.push({
          ...entry,
          status: 'unavailable',
          statusLabel: statusLabel('unavailable'),
          detail: 'Upgrade your plan or ask your platform admin to enable this module.',
        });
        continue;
      }
    }

    switch (entry.id) {
      case 'razorpay': {
        const integrations =
          companySettings &&
          typeof companySettings === 'object' &&
          !Array.isArray(companySettings)
            ? (companySettings as Record<string, unknown>).integrations
            : null;
        const rz =
          integrations &&
          typeof integrations === 'object' &&
          !Array.isArray(integrations)
            ? (integrations as Record<string, unknown>).razorpay
            : null;
        const enabled =
          rz &&
          typeof rz === 'object' &&
          !Array.isArray(rz) &&
          (rz as Record<string, unknown>).enabled === true;
        status = razorpay ? 'configured' : enabled ? 'configured' : 'disabled';
        detail = razorpay
          ? 'Credentials saved'
          : enabled
            ? 'Enabled — add API keys below'
            : undefined;
        break;
      }
      case 'whatsapp':
        status = whatsapp.status;
        detail = whatsapp.detail;
        break;
      case 'email':
        status = email.status;
        detail = email.detail;
        break;
      case 'google_calendar':
        status = calendar.status;
        detail = calendar.detail;
        break;
      case 'webhooks':
        status =
          webhooks.enabled && webhooks.subscriptions.some((s) => s.enabled && s.url)
            ? 'configured'
            : webhooks.subscriptions.length
              ? 'configured'
              : 'disabled';
        detail = webhooks.subscriptions.length
          ? `${webhooks.subscriptions.filter((s) => s.enabled).length} active endpoint(s)`
          : undefined;
        break;
      case 'api':
        status = 'configured';
        detail = 'Session + workspace slug header';
        break;
    }

    rows.push({
      ...entry,
      status,
      statusLabel: statusLabel(status),
      detail,
    });
  }

  return rows;
}

export { parseWebhooks };
