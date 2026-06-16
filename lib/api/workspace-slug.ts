/** Sent by browser clients under `/[company]/...` so APIs scope to the URL workspace (not only JWT primary company). */
export const WORKSPACE_SLUG_HEADER = "x-workspace-slug" as const

/**
 * Set by root `proxy.ts` from the signed-in JWT (`companySlug`).
 * Lets `/dashboard` API calls resolve the tenant without each fetch passing `x-workspace-slug`.
 */
export const SESSION_COMPANY_SLUG_HEADER = "x-company-slug" as const

/** Primary company id from JWT; set by root `proxy.ts`. */
export const SESSION_COMPANY_ID_HEADER = "x-company-id" as const

export function workspaceSlugHeaders(slug: string): HeadersInit {
  return { [WORKSPACE_SLUG_HEADER]: slug }
}
