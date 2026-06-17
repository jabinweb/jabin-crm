import NextAuth from 'next-auth'
import { authConfig, UserRole } from '@/auth.config'
import { createPrismaAuthAdapter } from '@/lib/auth/prisma-auth-adapter'
import { getUserPrimaryCompanyId } from '@/lib/auth/company-membership'
import { prisma } from '@/lib/prisma'

async function refreshGoogleAccessToken(token: {
  refreshToken?: string
  accessToken?: string
  expiresAt?: number
  error?: string
  [key: string]: unknown
}) {
  if (!token.refreshToken) return token

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    })

    const refreshedTokens = await response.json()
    if (!response.ok) throw refreshedTokens

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt: Math.floor(Date.now() / 1000 + (refreshedTokens.expires_in ?? 3600)),
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    }
  } catch (error) {
    console.error('[auth] Google token refresh failed:', error)
    return { ...token, error: 'RefreshAccessTokenError' }
  }
}

async function attachWorkspaceToToken(
  token: Record<string, unknown>,
  userId: string
) {
  try {
    const primaryCompanyId = await getUserPrimaryCompanyId(userId)
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        companyId: true,
        employeeProfile: { select: { id: true } },
      },
    })

    const resolvedCompanyId = primaryCompanyId ?? dbUser?.companyId ?? null
    const resolvedCompany = resolvedCompanyId
      ? await prisma.company.findUnique({
          where: { id: resolvedCompanyId },
          select: { slug: true },
        })
      : null

    token.companyId = resolvedCompanyId ?? undefined
    token.primaryCompanyId = resolvedCompanyId ?? undefined
    token.companySlug = resolvedCompany?.slug ?? undefined
    token.employeeId = dbUser?.employeeProfile?.id ?? undefined
  } catch (error) {
    console.error('[auth] Failed to load workspace for token:', error)
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: createPrismaAuthAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account }) {
      if (account && user) {
        token.id = user.id
        token.role = (user as { role?: string }).role || UserRole.SALES
        token.customerId = (user as { customerId?: string }).customerId
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at ?? Math.floor(Date.now() / 1000 + 3600)

        if (user.id) {
          await attachWorkspaceToToken(token as Record<string, unknown>, user.id)
        }
        return token
      }

      if (typeof token.expiresAt === 'number' && Date.now() < token.expiresAt * 1000) {
        return token
      }

      if (token.error === 'RefreshAccessTokenError' || !token.refreshToken) {
        return token
      }

      return refreshGoogleAccessToken(token as Parameters<typeof refreshGoogleAccessToken>[0])
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.customerId = token.customerId as string | undefined
        session.user.companyId = token.companyId as string | undefined
        session.user.primaryCompanyId = token.primaryCompanyId as string | undefined
        session.user.companySlug = token.companySlug as string | undefined
        session.user.employeeId = token.employeeId as string | undefined
      }

      session.accessToken = token.accessToken as string | undefined
      if (token.error) {
        session.error = token.error as string
      }

      return session
    },
  },
  events: {
    async signIn({ user, account }) {
      console.log('[auth] Signed in:', user.email, account?.provider)
    },
    async signOut() {
      console.log('[auth] Signed out')
    },
  },
})
