import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import Nodemailer from 'next-auth/providers/nodemailer'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeAuthEmail } from '@/lib/auth/normalize-email'
import { reconcileOAuthAccount, findCanonicalUserForEmail } from '@/lib/auth/oauth-reconcile'

const useSecureCookies = process.env.NODE_ENV === 'production'

export const authConfig = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
            authorization: {
              params: {
                scope:
                  'openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
                access_type: 'offline',
                prompt: 'consent',
                include_granted_scopes: 'true',
              },
            },
          }),
        ]
      : []),
    ...(process.env.SMTP_HOST && process.env.SMTP_USER
      ? [
          Nodemailer({
            server: {
              host: process.env.SMTP_HOST,
              port: Number(process.env.SMTP_PORT) || 587,
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
              },
            },
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
          }),
        ]
      : []),
    Credentials({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = normalizeAuthEmail(String(credentials.email))
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            password: true,
          },
        })

        if (!user?.password) return null

        const valid = await bcrypt.compare(String(credentials.password), user.password)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        }
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify-request',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
  cookies: {
    pkceCodeVerifier: {
      name: useSecureCookies
        ? '__Secure-authjs.pkce.code_verifier'
        : 'authjs.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        maxAge: 60 * 15,
      },
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email || !account?.provider) return false

      const normalizedEmail = normalizeAuthEmail(user.email)
      user.email = normalizedEmail

      try {
        if (account.provider !== 'credentials' && account.providerAccountId) {
          const resolvedId = await reconcileOAuthAccount(normalizedEmail, {
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              refresh_token: account.refresh_token,
              access_token: account.access_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              session_state:
                typeof account.session_state === 'string'
                  ? account.session_state
                  : undefined,
            })
          if (resolvedId) {
            user.id = resolvedId
            const dbUser = await prisma.user.findUnique({
              where: { id: resolvedId },
              select: { role: true },
            })
            if (dbUser?.role) {
              ;(user as { role?: string }).role = dbUser.role
            }
          }
        }

        const userCount = await prisma.user.count()
        if (userCount < 2) return true

        const existingUser = await findCanonicalUserForEmail(normalizedEmail)

        if (!existingUser) {
          console.log('[auth] Blocked sign-in: email not registered', normalizedEmail)
          return false
        }

        return true
      } catch (error) {
        console.error('[auth] signIn callback error:', error)
        return false
      }
    },
  },
} satisfies NextAuthConfig

export { UserRole }
