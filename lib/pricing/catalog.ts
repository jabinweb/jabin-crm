/**
 * Canonical India list prices (INR paise).
 * Positioned as accessible mid-market SaaS — typically well below heavy
 * “command center” list prices in Global USD markets.
 *
 * PPP multipliers in `lib/pricing/ppp.ts` adjust charge + display by country.
 */

export const INR_PER_USD_LIST = 83.33;

export function usdToInrPaise(usd: number): number {
  return Math.round(usd * INR_PER_USD_LIST) * 100;
}

/** Internal USD anchors for India list derivation (not shown to customers). */
const INTERNAL_USD = {
  starter: 72,
  professional: 180,
  enterprise: 276,
} as const;

export const PLAN_CATALOG = {
  free: {
    name: 'free',
    displayName: 'Free',
    description: 'Try the workspace — leads, basic tickets, and HR tools for a small team.',
    pricePaise: 0,
    interval: 'month',
    maxLeads: 50,
    maxEmails: 100,
    maxCampaigns: 2,
    features: [
      'Up to 50 leads / month',
      'Basic tickets & HRMS',
      'Client portal access',
      '14-day paid-plan trial available',
    ],
  },
  starter: {
    name: 'starter',
    displayName: 'Starter',
    description:
      'For growing service teams that need deals, chat, and inventory without enterprise weight.',
    pricePaise: usdToInrPaise(INTERNAL_USD.starter), // ₹5,999
    interval: 'month',
    maxLeads: 500,
    maxEmails: 3000,
    maxCampaigns: 15,
    features: [
      'Leads, deals & quotations',
      'Tickets + live chat + knowledge base',
      'Inventory & products',
      'Email outreach',
      'HRMS included',
      'Team-wide seats (no per-user fee)',
    ],
  },
  professional: {
    name: 'professional',
    displayName: 'Professional',
    description:
      'Full service ops: SLA, field tools, AMC/CMC, WhatsApp — priced for real SMBs, not enterprise bloat.',
    pricePaise: usdToInrPaise(INTERNAL_USD.professional), // ₹14,999
    interval: 'month',
    maxLeads: 5000,
    maxEmails: 25000,
    maxCampaigns: 100,
    features: [
      'Everything in Starter',
      'SLA policies & omnichannel inbox',
      'Equipment, GPS field tools & service reports',
      'AMC / CMC contract renewals',
      'Invoices & WhatsApp',
      'Team-wide seats — no per-user metering',
    ],
  },
  enterprise: {
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'Unlimited usage and every module for larger operations.',
    pricePaise: usdToInrPaise(INTERNAL_USD.enterprise), // ~₹22,999
    interval: 'month',
    maxLeads: -1,
    maxEmails: -1,
    maxCampaigns: -1,
    features: [
      'Everything in Professional',
      'Unlimited leads, emails & campaigns',
      'All modules unlocked',
      'Priority support path',
      'Team-wide seats, no user metering',
    ],
  },
} as const;

/** Explicit India list (marketing-rounded where needed). */
export const PLAN_LIST_PRICES_PAISE: Record<string, number> = {
  free: PLAN_CATALOG.free.pricePaise,
  starter: 599900, // ₹5,999
  professional: PLAN_CATALOG.professional.pricePaise, // ₹14,999
  enterprise: 2299900, // ₹22,999
};
