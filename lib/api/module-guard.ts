import { auth } from '@/auth';
import type { Session } from 'next-auth';
import { ApiErrors } from '@/lib/api-error-handler';
import {
  guardAgentFeature,
  requireLeadQuota,
  requireEmailQuota,
  requireCampaignQuota,
  recordLeadCreated,
  recordEmailSent,
  recordCampaignCreated,
} from '@/lib/api/subscription-guards';
import type { FeatureModuleKey } from '@/lib/feature-module-keys';

type QuotaKind = 'leads' | 'emails' | 'campaigns';

export async function withModuleAccess(
  module: FeatureModuleKey,
  options?: { quota?: QuotaKind }
): Promise<Session> {
  const session = await auth();
  await guardAgentFeature(session?.user as { id: string; role?: string }, module);

  if (options?.quota && session?.user?.id) {
    if (options.quota === 'leads') await requireLeadQuota(session.user.id);
    if (options.quota === 'emails') await requireEmailQuota(session.user.id);
    if (options.quota === 'campaigns') await requireCampaignQuota(session.user.id);
  }

  if (!session) {
    throw ApiErrors.unauthorized();
  }

  return session;
}

export async function afterLeadCreated(userId: string) {
  await recordLeadCreated(userId);
}

export async function afterEmailSent(userId: string, count = 1) {
  await recordEmailSent(userId, count);
}

export async function afterCampaignCreated(userId: string) {
  await recordCampaignCreated(userId);
}

export async function guardTicketAccess(user: { id: string; role?: string } | null | undefined) {
  await guardAgentFeature(user, 'TICKETS');
}

export async function guardTicketAdvanced(user: { id: string; role?: string } | null | undefined) {
  await guardAgentFeature(user, 'TICKET_ADVANCED');
}

export async function guardSlaAccess(user: { id: string; role?: string } | null | undefined) {
  await guardAgentFeature(user, 'SUPPORT_SLA');
}
