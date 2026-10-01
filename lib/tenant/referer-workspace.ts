/** Top-level routes that are not workspace slugs (siblings of app/[company]). */
const NON_WORKSPACE_SEGMENTS = new Set([
  'api',
  'admin',
  'auth',
  'dashboard',
  'embed',
  'employee',
  'monitoring',
  'payment',
  'portal',
  'pricing',
  'privacy',
  'register',
  'service-request',
  'start',
  'terms',
  'ticket',
  'unsubscribe',
  'workspace',
  '_next',
]);

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Which workspace is the page that made this API call in?
 *
 * Read from a same-origin Referer: `/acme/dashboard/...` in path mode, or the `acme.`
 * subdomain in subdomain mode. Returns null when it cannot tell. The result is only a
 * hint — the API still checks that the user belongs to that workspace.
 */
export function workspaceSlugFromReferer(input: {
  referer: string | null;
  /** Host the request was made to (x-forwarded-host or host) */
  host: string | null;
  subdomainMode?: boolean;
  reservedSubdomains?: ReadonlySet<string>;
}): string | null {
  if (!input.referer) return null;
  let url: URL;
  try {
    url = new URL(input.referer);
  } catch {
    return null;
  }

  const host = (input.host || '').split(',')[0].trim().toLowerCase();
  if (!host || url.host.toLowerCase() !== host) return null;

  const segment = url.pathname.split('/')[1]?.toLowerCase() ?? '';
  if (segment && !NON_WORKSPACE_SEGMENTS.has(segment) && SLUG_RE.test(segment)) {
    return segment;
  }

  if (input.subdomainMode) {
    const labels = url.hostname.toLowerCase().split('.');
    const sub = labels[0];
    if (labels.length > 2 && SLUG_RE.test(sub) && !input.reservedSubdomains?.has(sub)) {
      return sub;
    }
  }
  return null;
}
