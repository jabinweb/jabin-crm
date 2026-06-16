import { ensureFeatureEnabled, ensureFeatureEnabledForCompany } from '@/lib/feature-modules';
import { checkUsageLimits, incrementUsage } from '@/lib/subscription';
import { ApiErrors, ApiException } from '@/lib/api-error-handler';
import type { FeatureModuleKey } from '@/lib/feature-module-keys';

type SessionUser = {
  id: string;
  role?: string;
};

/** Skip feature checks for portal customers; agents must have the module on their plan. */
export async function guardAgentFeature(
  user: SessionUser | null | undefined,
  module: FeatureModuleKey
): Promise<void> {
  if (!user?.id) {
    throw ApiErrors.unauthorized();
  }
  if (user.role === 'CUSTOMER') {
    return;
  }
  await ensureFeatureEnabled(user.id, module);
}

export async function requireLeadQuota(userId: string): Promise<void> {
  const limits = await checkUsageLimits(userId);
  if (!limits.canCreateLead) {
    throw ApiErrors.forbidden(
      'Lead limit reached for your subscription plan. Upgrade to create more leads.'
    );
  }
}

export async function requireEmailQuota(userId: string): Promise<void> {
  const limits = await checkUsageLimits(userId);
  if (!limits.canSendEmail) {
    throw ApiErrors.forbidden(
      'Email limit reached for your subscription plan. Upgrade to send more emails.'
    );
  }
}

export async function requireEmailQuotaForCount(
  userId: string,
  count: number
): Promise<void> {
  if (count <= 0) return;
  const limits = await checkUsageLimits(userId);
  if (limits.emailsRemaining === -1) return;
  if (limits.emailsRemaining < count) {
    throw ApiErrors.forbidden(
      `Email limit reached. This send needs ${count} emails but you have ${limits.emailsRemaining} remaining on your plan.`
    );
  }
}

export async function requireCampaignQuota(userId: string): Promise<void> {
  const limits = await checkUsageLimits(userId);
  if (!limits.canCreateCampaign) {
    throw ApiErrors.forbidden(
      'Campaign limit reached for your subscription plan. Upgrade to create more campaigns.'
    );
  }
}

export async function recordLeadCreated(userId: string): Promise<void> {
  await incrementUsage(userId, 'leads');
}

export async function recordEmailSent(userId: string, count = 1): Promise<void> {
  await incrementUsage(userId, 'emails', count);
}

export async function recordCampaignCreated(userId: string): Promise<void> {
  await incrementUsage(userId, 'campaigns');
}

export function isApiException(error: unknown): error is ApiException {
  return error instanceof ApiException;
}

export async function assertLiveChatEnabled(options: {
  companyId?: string | null;
  userId?: string | null;
}): Promise<void> {
  if (options.companyId) {
    await ensureFeatureEnabledForCompany(options.companyId, 'SUPPORT_LIVE_CHAT');
    return;
  }
  if (options.userId) {
    await ensureFeatureEnabled(options.userId, 'SUPPORT_LIVE_CHAT');
  }
}
