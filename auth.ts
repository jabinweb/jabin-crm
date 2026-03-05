import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Nodemailer from "next-auth/providers/nodemailer"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

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
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        authorization: {
          params: {
            scope: 'openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
            access_type: 'offline',
            prompt: 'consent',
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
      if (user) {
        token.id = user.id
        token.role = (user as any).role || UserRole.SALES
        token.customerId = (user as any).customerId
      }
      // Store Google access/refresh tokens
      if (account?.provider === 'google') {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.customerId = token.customerId as string
        session.accessToken = token.accessToken as string
        session.refreshToken = token.refreshToken as string
      }
      return session
    },
    async signIn({ user, account, profile }) {
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
