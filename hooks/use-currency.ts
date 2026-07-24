'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import {
  formatCurrency as formatCurrencyUtil,
  PRODUCT_DEFAULT_CURRENCY,
  type CurrencyCode,
} from '@/lib/currency';
import { companyDefaultCurrencyFromSettings } from '@/lib/currency/resolve';
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug';

/**
 * Company default currency for staff UI (create forms, dashboards).
 * Document displays should still pass the document's own currency.
 */
export function useCurrency() {
  const params = useParams<{ company?: string }>();
  const workspaceSlug = typeof params?.company === 'string' ? params.company : undefined;

  const { data: settingsData } = useQuery({
    queryKey: ['settings', workspaceSlug, 'currency'],
    queryFn: async () => {
      const headers = workspaceSlug ? workspaceSlugHeaders(workspaceSlug) : {};
      const response = await fetch('/api/dashboard/settings', { headers: { ...headers } });
      if (!response.ok) return null;
      return response.json() as Promise<{ settings?: unknown }>;
    },
    staleTime: 60_000,
  });

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await fetch('/api/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    },
    staleTime: 60_000,
  });

  const companyCurrency = companyDefaultCurrencyFromSettings(settingsData?.settings);
  const currency = (companyCurrency ||
    profile?.preferredCurrency ||
    PRODUCT_DEFAULT_CURRENCY) as CurrencyCode;

  const formatCurrency = (amount: number, overrideCurrency?: CurrencyCode | string) => {
    return formatCurrencyUtil(amount, (overrideCurrency || currency) as CurrencyCode);
  };

  return {
    currency,
    companyCurrency,
    formatCurrency,
  };
}
