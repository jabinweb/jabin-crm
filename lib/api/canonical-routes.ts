/**
 * Canonical API path constants — use these in new code.
 */
export const API_ROUTES = {
  customers: '/api/customers',
  inventory: '/api/inventory',
  inventoryInstallations: '/api/inventory/installations',
  products: '/api/products',
  emailTrackOpen: (id: string) => `/api/emails/track/open/${id}`,
  emailTrackClick: (id: string, url: string) =>
    `/api/emails/track/click/${id}?url=${encodeURIComponent(url)}`,
} as const;

/** Legacy email tracking paths — alias to {@link API_ROUTES.emailTrackOpen}. */
export const LEGACY_EMAIL_TRACK_PREFIXES = ['/api/track', '/api/email/track'] as const;
