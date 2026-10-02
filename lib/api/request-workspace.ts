import { NextRequest } from 'next/server';
import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';

/**
 * Workspace (company id) the current request is acting in, for code that only has a
 * user id — e.g. plan-module checks. Uses the same resolution as API routes (explicit
 * workspace header, then the page the call came from, then the sign-in workspace),
 * so a user who belongs to several workspaces is checked against the one they are in.
 *
 * Returns null outside a request (cron, scripts) or when it can't be resolved; callers
 * then fall back to the user's home workspace.
 */
export async function requestCompanyIdForUser(userId: string): Promise<string | null> {
  let requestHeaders: Headers;
  try {
    const { headers } = await import('next/headers');
    requestHeaders = new Headers(await headers());
  } catch {
    return null; // not inside a request
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, companyId: true, primaryCompanyId: true },
    });
    if (!user) return null;
    const session = {
      user: {
        id: user.id,
        role: user.role,
        companyId: user.companyId ?? undefined,
        primaryCompanyId: user.primaryCompanyId ?? undefined,
      },
    } as unknown as Session;
    const request = new NextRequest('http://internal.local/', { headers: requestHeaders });
    const { companyId } = await resolveCompanyContextFromRequest(session, request);
    return companyId ?? null;
  } catch {
    return null;
  }
}
