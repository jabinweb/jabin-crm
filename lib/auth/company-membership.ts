import type { CompanyStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  SESSION_COMPANY_ID_HEADER,
  SESSION_COMPANY_SLUG_HEADER,
  WORKSPACE_SLUG_HEADER,
} from "@/lib/api/workspace-slug"
import type { Session } from "next-auth"
import type { NextRequest } from "next/server"
import { redirect, notFound } from "next/navigation"
import { getToken } from "next-auth/jwt"

export class TenantError extends Error {
  readonly status: number
  /** Machine-readable reason for clients (e.g. dashboard empty state). */
  readonly code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = "TenantError"
    this.status = status
    this.code = code
  }
}

type CompanyContext = {
  userId: string
  companyId: string
  employeeId?: string
}

async function getPrimaryCompanyIdFromJoinTables(userId: string): Promise<string | null> {
  const membership = await prisma.userCompany.findFirst({
    where: { userId },
    select: { companyId: true },
  })
  return membership?.companyId ?? null
}

/**
 * Canonical: join tables (`UserCompany`) with legacy fallback to cached user fields.
 *
 * During migration, many users may still only have `User.primaryCompanyId` populated.
 */
export async function getUserPrimaryCompanyId(userId: string): Promise<string | null> {
  const fromJoin = await getPrimaryCompanyIdFromJoinTables(userId)
  if (fromJoin) return fromJoin

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { primaryCompanyId: true, companyId: true },
  })
  return user?.primaryCompanyId ?? user?.companyId ?? null
}

export async function userHasCompanyAccess(userId: string, companyId: string): Promise<boolean> {
  const membership = await prisma.userCompany.findFirst({
    where: { userId, companyId },
    select: { userId: true },
  })
  if (membership) return true

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { primaryCompanyId: true, companyId: true },
  })
  return user?.primaryCompanyId === companyId || user?.companyId === companyId
}

export async function getUserCompanyRole(userId: string, companyId: string) {
  const role = await prisma.userCompanyRole.findFirst({
    where: { userId, companyId },
    select: { role: true },
  })
  return role?.role ?? null
}

export async function requireCompanyContextFromUser(user: any): Promise<CompanyContext> {
  const userId = user?.id as string | undefined
  if (!userId) throw new TenantError(401, "Unauthorized")

  const companyId =
    (await getUserPrimaryCompanyId(userId)) ??
    (user?.primaryCompanyId as string | undefined) ??
    (user?.companyId as string | undefined) ??
    null

  if (!companyId) throw new TenantError(403, "Company not found", "NO_COMPANY")

  return {
    userId,
    companyId,
    employeeId: user?.employeeId as string | undefined,
  }
}

/**
 * Extract a company context from a NextAuth session.
 *
 * - Company is derived via join tables first, then legacy session fields.
 * - Keeps behavior stable while we migrate reads/writes.
 */
export async function requireCompanyContext(session: Session | null): Promise<CompanyContext> {
  const userId = session?.user?.id
  if (!userId) {
    throw new TenantError(401, "Unauthorized")
  }

  const companyId =
    (await getUserPrimaryCompanyId(userId)) ??
    (session.user as any)?.primaryCompanyId ??
    (session.user as any)?.companyId ??
    null

  if (!companyId) {
    throw new TenantError(403, "Company not found", "NO_COMPANY")
  }

  return {
    userId,
    companyId,
    employeeId: (session.user as any)?.employeeId as string | undefined,
  }
}

/**
 * Prefer `x-workspace-slug` (or `?workspace=` query) when present so the active URL tenant
 * matches API scope (e.g. SUPER_ADMIN working inside another company’s dashboard).
 * Then `x-company-slug` / `x-company-id` from `proxy.ts` (JWT) so `/dashboard` fetches work without
 * every client passing `x-workspace-slug`.
 * Otherwise falls back to `requireCompanyContext(session)`.
 */
export async function resolveCompanyContextFromRequest(
  session: Session | null,
  request: NextRequest
): Promise<CompanyContext> {
  let workspaceSlug =
    request.headers.get(WORKSPACE_SLUG_HEADER)?.trim() ||
    request.nextUrl.searchParams.get("workspace")?.trim() ||
    request.headers.get(SESSION_COMPANY_SLUG_HEADER)?.trim() ||
    null

  let headerCompanyId = request.headers.get(SESSION_COMPANY_ID_HEADER)?.trim() || null

  if (!workspaceSlug && !headerCompanyId && process.env.AUTH_SECRET) {
    try {
      const token = await getToken({ req: request, secret: process.env.AUTH_SECRET })
      if (token) {
        const fromSlug =
          typeof token.companySlug === "string" ? token.companySlug.trim() : ""
        const fromId = typeof token.companyId === "string" ? token.companyId.trim() : ""
        if (fromSlug) workspaceSlug = fromSlug
        if (fromId) headerCompanyId = headerCompanyId || fromId
      }
    } catch {
      /* ignore JWT decode errors */
    }
  }

  const userId = session?.user?.id
  if (!userId) {
    throw new TenantError(401, "Unauthorized")
  }

  if (workspaceSlug) {
    const company = await prisma.company.findUnique({
      where: { slug: workspaceSlug },
      select: { id: true, status: true },
    })
    if (!company || company.status === "REJECTED") {
      throw new TenantError(404, "Company not found")
    }

    const role = (session.user as any)?.role as string | undefined
    if (role === "SUPER_ADMIN") {
      return {
        userId,
        companyId: company.id,
        employeeId: (session.user as any)?.employeeId as string | undefined,
      }
    }

    const ok = await userHasCompanyAccess(userId, company.id)
    if (!ok) {
      throw new TenantError(403, "Forbidden")
    }

    return {
      userId,
      companyId: company.id,
      employeeId: (session.user as any)?.employeeId as string | undefined,
    }
  }

  if (headerCompanyId) {
    const company = await prisma.company.findUnique({
      where: { id: headerCompanyId },
      select: { id: true, status: true },
    })
    if (!company || company.status !== "APPROVED") {
      throw new TenantError(404, "Company not found")
    }

    const role = (session.user as any)?.role as string | undefined
    if (role === "SUPER_ADMIN") {
      return {
        userId,
        companyId: company.id,
        employeeId: (session.user as any)?.employeeId as string | undefined,
      }
    }

    const ok = await userHasCompanyAccess(userId, company.id)
    if (!ok) {
      throw new TenantError(403, "Forbidden")
    }

    return {
      userId,
      companyId: company.id,
      employeeId: (session.user as any)?.employeeId as string | undefined,
    }
  }

  return requireCompanyContext(session)
}

/**
 * Whether server layouts/pages may render for this company row.
 * - APPROVED: public shell (child routes still enforce auth as needed).
 * - PENDING: only users linked to that company (e.g. after saving workspace URL).
 * - REJECTED: never.
 */
export async function isCompanyLayoutAllowed(
  company: { id: string; status: CompanyStatus } | null,
  session: Session | null
): Promise<boolean> {
  if (!company) return false
  if (company.status === "REJECTED") return false
  if (company.status === "APPROVED") return true
  const userId = session?.user?.id
  if (!userId) return false
  return userHasCompanyAccess(userId, company.id)
}

/**
 * Server layout guard: logged-in user must belong to this company (or be SUPER_ADMIN).
 * Otherwise redirect to their primary company home or 404.
 */
export async function assertSessionCompanyAccess(
  session: Session | null,
  company: { id: string; slug: string },
  homePathSuffix: string
): Promise<void> {
  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  const role = (session.user as any)?.role as string | undefined
  if (role === "SUPER_ADMIN") {
    return
  }

  const ok = await userHasCompanyAccess(session.user.id, company.id)
  if (ok) {
    return
  }

  const primaryId = await getUserPrimaryCompanyId(session.user.id)
  if (primaryId) {
    const c = await prisma.company.findUnique({
      where: { id: primaryId },
      select: { slug: true },
    })
    if (c?.slug && c.slug !== company.slug) {
      const path = homePathSuffix ? `/${c.slug}/${homePathSuffix}` : `/${c.slug}`
      redirect(path)
    }
  }

  notFound()
}
