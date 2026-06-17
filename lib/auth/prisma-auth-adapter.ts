import { PrismaAdapter } from '@auth/prisma-adapter'
import type { Adapter, AdapterAccount, AdapterUser } from '@auth/core/adapters'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeAuthEmail } from '@/lib/auth/normalize-email'
import {
  findCanonicalUserForEmail,
  oauthTokenFields,
  reconcileOAuthAccount,
} from '@/lib/auth/oauth-reconcile'

async function resolveBootstrapRole(): Promise<string> {
  const superAdminExists = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true },
  })
  if (!superAdminExists) return 'SUPER_ADMIN'

  const adminExists = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  })
  if (!adminExists) return 'ADMIN'

  return 'SALES'
}

export function createPrismaAuthAdapter(client: PrismaClient = prisma): Adapter {
  const base = PrismaAdapter(client)

  return {
    ...base,
    getUserByEmail: async (email: string) => {
      const normalizedEmail = normalizeAuthEmail(email)
      const canonical = await findCanonicalUserForEmail(normalizedEmail)
      return (canonical ?? null) as AdapterUser | null
    },
    createUser: async (user) => {
      const normalizedEmail = user.email ? normalizeAuthEmail(user.email) : user.email

      if (normalizedEmail) {
        const existing = await findCanonicalUserForEmail(normalizedEmail)
        if (existing) {
          return existing as AdapterUser
        }
      }

      const role = await resolveBootstrapRole()
      const created = await client.user.create({
        data: {
          ...user,
          email: normalizedEmail ?? user.email,
          role: role as never,
        },
      })

      console.log(`[auth] Bootstrapped ${created.email} as ${role}`)
      return created as AdapterUser
    },
    linkAccount: async (account: AdapterAccount) => {
      const oauthUser = await client.user.findUnique({
        where: { id: account.userId },
        select: { email: true },
      })

      const canonicalUserId = oauthUser?.email
        ? await reconcileOAuthAccount(oauthUser.email, account)
        : null

      const userId = canonicalUserId ?? account.userId
      const tokens = oauthTokenFields(account)

      const existing = await client.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
      })

      if (existing) {
        if (existing.userId !== userId) {
          await client.account.update({
            where: { id: existing.id },
            data: { userId, ...tokens },
          })
        } else {
          await client.account.update({
            where: { id: existing.id },
            data: tokens,
          })
        }
        return
      }

      await client.account.create({
        data: {
          userId,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          ...tokens,
        },
      })
    },
  }
}
