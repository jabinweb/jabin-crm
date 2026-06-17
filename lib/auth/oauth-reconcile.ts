import { prisma } from '@/lib/prisma'
import { normalizeAuthEmail } from '@/lib/auth/normalize-email'

export type OAuthAccountPayload = {
  type: string
  provider: string
  providerAccountId: string
  refresh_token?: string | null
  access_token?: string | null
  expires_at?: number | null
  token_type?: string | null
  scope?: string | null
  id_token?: string | null
  session_state?: string | null
}

export function oauthTokenFields(account: OAuthAccountPayload) {
  return {
    type: account.type,
    refresh_token: account.refresh_token,
    access_token: account.access_token,
    expires_at: account.expires_at,
    token_type: account.token_type,
    scope: account.scope,
    id_token: account.id_token,
    session_state: account.session_state ?? undefined,
  }
}

function userCompletenessScore(user: {
  password: string | null
  employeeProfile: { id: string } | null
  userCompanies: unknown[]
  subscription: { id: string } | null
  accounts: unknown[]
}) {
  let score = 0
  if (user.password) score += 100
  if (user.userCompanies.length > 0) score += 50
  if (user.employeeProfile) score += 50
  if (user.subscription) score += 30
  score += user.accounts.length * 10
  return score
}

export async function findCanonicalUserForEmail(email: string) {
  const normalizedEmail = normalizeAuthEmail(email)
  const users = await prisma.user.findMany({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    include: {
      accounts: true,
      employeeProfile: { select: { id: true } },
      userCompanies: { take: 1 },
      subscription: { select: { id: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (users.length === 0) return null
  if (users.length === 1) return users[0]

  return [...users].sort(
    (a, b) => userCompletenessScore(b) - userCompletenessScore(a)
  )[0]
}

async function maybeRemoveOrphanOAuthUser(orphanUserId: string, keepUserId: string) {
  if (orphanUserId === keepUserId) return

  const orphan = await prisma.user.findUnique({
    where: { id: orphanUserId },
    include: {
      accounts: true,
      employeeProfile: { select: { id: true } },
      userCompanies: { take: 1 },
      subscription: { select: { id: true } },
    },
  })

  if (!orphan) return

  const isOAuthShell =
    !orphan.password &&
    !orphan.employeeProfile &&
    orphan.userCompanies.length === 0 &&
    !orphan.subscription &&
    orphan.accounts.length === 0

  if (isOAuthShell) {
    await prisma.user.delete({ where: { id: orphanUserId } })
  }
}

/** Move OAuth account to the canonical user for this email (fixes OAuthAccountNotLinked). */
export async function reconcileOAuthAccount(
  email: string,
  account: OAuthAccountPayload
): Promise<string | null> {
  if (account.provider === 'credentials' || !account.providerAccountId) {
    return null
  }

  const normalizedEmail = normalizeAuthEmail(email)
  const tokens = oauthTokenFields(account)

  const [oauthAccount, canonicalUser] = await Promise.all([
    prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        },
      },
    }),
    findCanonicalUserForEmail(normalizedEmail),
  ])

  const canonicalUserId = canonicalUser?.id ?? oauthAccount?.userId ?? null
  if (!canonicalUserId) return null

  if (oauthAccount) {
    if (oauthAccount.userId !== canonicalUserId) {
      await prisma.account.update({
        where: { id: oauthAccount.id },
        data: { userId: canonicalUserId, ...tokens },
      })
      await maybeRemoveOrphanOAuthUser(oauthAccount.userId, canonicalUserId)
    } else {
      await prisma.account.update({
        where: { id: oauthAccount.id },
        data: tokens,
      })
    }
  } else {
    await prisma.account.create({
      data: {
        userId: canonicalUserId,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        ...tokens,
      },
    })
  }

  if (canonicalUser && canonicalUser.email !== normalizedEmail) {
    await prisma.user.update({
      where: { id: canonicalUser.id },
      data: { email: normalizedEmail },
    })
  }

  // Merge duplicate user rows that share this email into the canonical account.
  const duplicates = await prisma.user.findMany({
    where: {
      email: { equals: normalizedEmail, mode: 'insensitive' },
      id: { not: canonicalUserId },
    },
    select: { id: true },
  })

  for (const duplicate of duplicates) {
    await maybeRemoveOrphanOAuthUser(duplicate.id, canonicalUserId)
  }

  return canonicalUserId
}
