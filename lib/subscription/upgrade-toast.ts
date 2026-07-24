'use client';

import { toast } from 'sonner';

/**
 * Show a clear upgrade prompt when an API returns UPGRADE_REQUIRED / plan-limit 403.
 * Returns true if handled as upgrade.
 */
export function toastUpgradeIfNeeded(
  payload: { error?: string; code?: string; message?: string } | null | undefined,
  upgradeHref = '/pricing'
): boolean {
  const code = payload?.code;
  const message = payload?.error || payload?.message || '';
  const looksLikeUpgrade =
    code === 'UPGRADE_REQUIRED' ||
    /upgrade|limit reached|subscription plan/i.test(message);

  if (!looksLikeUpgrade) return false;

  toast.error(message || 'Plan limit reached', {
    description: 'Upgrade your workspace plan to continue.',
    action: {
      label: 'Upgrade',
      onClick: () => {
        window.location.href = upgradeHref;
      },
    },
    duration: 8000,
  });
  return true;
}
