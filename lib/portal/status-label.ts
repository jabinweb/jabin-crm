/**
 * Customer-facing labels for enum-ish status values shown in the portal.
 * Falls back to sentence case ("IN_PROGRESS" → "In progress") for anything unmapped.
 */
const OVERRIDES: Record<string, string> = {
  AMC: 'Annual maintenance (AMC)',
  CMC: 'Comprehensive maintenance (CMC)',
  SENT: 'Awaiting decision',
  VIEWED: 'Awaiting decision',
  PARTIAL: 'Partially paid',
  ACCEPTED: 'Approved',
  REJECTED: 'Declined',
  CONVERTED: 'Approved',
  CAPTURED: 'Received',
  AUTHORIZED: 'Authorised',
  TODO: 'To do',
  SEO: 'SEO',
  WEBAPP: 'Web app',
};

/** Invoice statuses read differently from quotes ("Sent" means "Awaiting payment"). */
const INVOICE_OVERRIDES: Record<string, string> = {
  SENT: 'Awaiting payment',
  VIEWED: 'Awaiting payment',
};

export function humanizeStatus(value: string | null | undefined, kind?: 'invoice'): string {
  if (!value) return '';
  const key = value.toUpperCase();
  if (kind === 'invoice' && INVOICE_OVERRIDES[key]) return INVOICE_OVERRIDES[key];
  if (OVERRIDES[key]) return OVERRIDES[key];
  const words = value.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
