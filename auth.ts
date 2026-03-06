import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Nodemailer from "next-auth/providers/nodemailer"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

async function refreshGoogleAccessToken(token: any) {
  if (!token.refreshToken) {
    return token
  }
  try {
    const url = "https://oauth2.googleapis.com/token";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt: Math.floor(Date.now() / 1000 + (refreshedTokens.expires_in ?? 3600)),
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error("Error refreshing Google access token", error);

    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: {
    ...PrismaAdapter(prisma),
    createUser: async (user: any) => {
      const superAdminExists = await prisma.user.findFirst({
        where: { role: 'SUPER_ADMIN' as any }
      })

      let role = 'SALES'
      if (!superAdminExists) {
        role = 'SUPER_ADMIN'
      } else {
        const adminExists = await prisma.user.findFirst({
          where: { role: 'ADMIN' as any }
        })
        if (!adminExists) {
          role = 'ADMIN'
        }
      }

      const createdUser = await prisma.user.create({
        data: {
          ...user,
          role: role as any
        }
      })

      console.log(`Successfully bootstrapped ${createdUser.email} as ${role}`)
      return createdUser
    }
  } as any,
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          authorization: {
            params: {
              scope:
                "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
              access_type: "offline",
              include_granted_scopes: "true",
            },
          },
        })]
      : []),
    ...(process.env.SMTP_HOST && process.env.SMTP_USER
      ? [Nodemailer({
        server: {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        },
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
      })]
      : []),
  ],
  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify-request',
    error: '/auth/error',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // First login
      if (account && user) {
        return {
          ...token,
          id: user.id,
          role: (user as any).role || UserRole.SALES,
          customerId: (user as any).customerId,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at ?? Math.floor(Date.now() / 1000 + 3600),
        }
      }

      // If token still valid return it

      if (typeof token.expiresAt === "number" && Date.now() < token.expiresAt * 1000) {
        return token
      }

      if (token.error === "RefreshAccessTokenError") {
        return token
      }

      if (!token.refreshToken) {
        return token
      }

      return await refreshGoogleAccessToken(token)
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.customerId = token.customerId as string
      }

      session.accessToken = token.accessToken as string
      if (token.error) {
        session.error = token.error as string
      }

      return session
    },
    async signIn({ user, account, profile }) {
      if (!user.email || !account?.provider) {
        return false
      }
      // Log sign-in attempts for debugging
      console.log('Sign-in attempt:', { provider: account?.provider, email: user.email })

      try {
        const userCount = await prisma.user.count()

        // Bootstrap Phase: Allow first 2 users to sign up
        if (userCount < 2) {
          return true
        }

        // Restricted Phase: Only allow if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email as string },
          select: { id: true }
        })

        if (!existingUser) {
          console.log('Access denied: New signups are disabled after bootstrapping.')
          return false // Block unauthorized new signups
        }

        return true
      } catch (error) {
        console.error('SignIn callback error:', error)
        return true // Fallback to allowed in case of DB error
      }
    },
  },
  events: {
    async signIn({ user }) {
      console.log('User signed in:', user.email)
    },
    async signOut() {
      console.log('User signed out')
    },
  },
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === 'development',
  trustHost: true,
})
