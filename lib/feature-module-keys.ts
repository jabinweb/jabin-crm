/**
 * Billable CRM, support, and outreach modules controlled by subscription plans.
 *
 * Company-internal HRMS (attendance, payroll, leave, employees) is intentionally
 * NOT listed here — it is available to every approved company workspace regardless
 * of plan tier. Only add keys for customer-facing / revenue modules.
 *
 * Public email webhooks and tracking pixels (/api/emails/reply, /api/emails/track/*,
 * legacy aliases /api/track/* and /api/email/track/*) are outside this matrix.
 */
export const ALL_FEATURE_MODULES = [
  'LEADS',
  'DEALS',
  'QUOTATIONS',
  'INVOICES',
  'TICKETS',
  'SUPPORT_INBOX',
  'SUPPORT_SLA',
  'SUPPORT_LIVE_CHAT',
  'SUPPORT_KNOWLEDGE',
  'SUPPORT_CANNED',
  'SUPPORT_GROUPS',
  'TICKET_ADVANCED',
  'INVENTORY',
  'EQUIPMENT',
  'SERVICE_REPORTS',
  'SERVICE_CASH',
  'SERVICE_EXPENSES',
  'SERVICE_GPS',
  'WHATSAPP',
  'EMAIL_OUTREACH',
] as const;

export type FeatureModuleKey = (typeof ALL_FEATURE_MODULES)[number];

export type PlanModuleMap = Record<FeatureModuleKey, boolean>;

export const FEATURE_MODULE_LABELS: Record<FeatureModuleKey, string> = {
  LEADS: 'Leads',
  DEALS: 'Deals',
  QUOTATIONS: 'Quotations',
  INVOICES: 'Invoices',
  TICKETS: 'Tickets',
  SUPPORT_INBOX: 'Omnichannel inbox',
  SUPPORT_SLA: 'SLA policies',
  SUPPORT_LIVE_CHAT: 'Live chat',
  SUPPORT_KNOWLEDGE: 'Knowledge base',
  SUPPORT_CANNED: 'Canned responses',
  SUPPORT_GROUPS: 'Agent groups',
  TICKET_ADVANCED: 'Ticket merge & split',
  INVENTORY: 'Inventory & products',
  EQUIPMENT: 'Assets & equipment',
  SERVICE_REPORTS: 'Service reports',
  SERVICE_CASH: 'Service cash',
  SERVICE_EXPENSES: 'Travel & expenses',
  SERVICE_GPS: 'GPS tracking',
  WHATSAPP: 'WhatsApp',
  EMAIL_OUTREACH: 'Email outreach',
};
