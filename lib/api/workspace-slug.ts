/** Sent by browser clients under `/[company]/...` so APIs scope to the URL workspace (not only JWT primary company). */
export const WORKSPACE_SLUG_HEADER = "x-workspace-slug" as const

/**
 * Set by root `proxy.ts` from the signed-in JWT (`companySlug`).
 * Lets `/dashboard` API calls resolve the tenant without each fetch passing `x-workspace-slug`.
 */
export const SESSION_COMPANY_SLUG_HEADER = "x-company-slug" as const

/**
 * Workspace of the page that made an API call, derived by `proxy.ts` from the Referer.
 * Most client code calls `fetch('/api/...')` without `x-workspace-slug`; without this hint
 * those calls fell back to the sign-in company, so a user who belongs to two workspaces saw
 * the first one's data while browsing the second. It is only a hint: the API still verifies
 * the user belongs to that workspace and ignores it otherwise.
 */
export const REFERER_WORKSPACE_HEADER = "x-referer-workspace" as const

/** Primary company id from JWT; set by root `proxy.ts`. */
export const SESSION_COMPANY_ID_HEADER = "x-company-id" as const

export function workspaceSlugHeaders(slug: string): HeadersInit {
  return { [WORKSPACE_SLUG_HEADER]: slug }
}
