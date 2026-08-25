import type { IntegrationCatalogEntry } from '@/lib/integrations/types';

export const INTEGRATION_CATALOG: IntegrationCatalogEntry[] = [
  {
    id: 'razorpay',
    name: 'Razorpay',
    description: 'Collect payments on invoices and payroll with your own Razorpay account.',
    category: 'payments',
    scope: 'company',
    inlinePanel: 'razorpay',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Send and receive WhatsApp from the support inbox (Summora, Twilio, or Meta Cloud).',
    category: 'messaging',
    scope: 'workspace_admin',
    featureModule: 'WHATSAPP',
    configurePath: '/dashboard/whatsapp?tab=provider',
  },
  {
    id: 'email',
    name: 'Email (SMTP / IMAP)',
    description: 'Send quotes, invoices, and outreach from your company mailbox.',
    category: 'messaging',
    scope: 'workspace_admin',
    featureModule: 'EMAIL_OUTREACH',
    inlinePanel: 'email',
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Sync meetings and site visits with Google Calendar.',
    category: 'productivity',
    scope: 'workspace_admin',
    inlinePanel: 'google_calendar',
  },
  {
    id: 'webhooks',
    name: 'Outgoing webhooks',
    description: 'Notify your systems when tickets, deals, or invoices change in Opslane.',
    category: 'developer',
    scope: 'company',
    inlinePanel: 'webhooks',
  },
  {
    id: 'api',
    name: 'REST API',
    description: 'Build custom integrations with session-authenticated tenant APIs.',
    category: 'developer',
    scope: 'company',
    docsPath: '/dashboard/docs',
  },
];

export const INTEGRATION_CATEGORY_LABELS: Record<
  IntegrationCatalogEntry['category'],
  string
> = {
  payments: 'Payments',
  messaging: 'Messaging & email',
  productivity: 'Productivity',
  developer: 'Developer',
};

export function getIntegrationCatalogEntry(id: string): IntegrationCatalogEntry | undefined {
  return INTEGRATION_CATALOG.find((entry) => entry.id === id);
}
