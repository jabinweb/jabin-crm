'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PPP_COUNTRY_OPTIONS } from '@/lib/pricing/ppp';

type Props = {
  countryCode: string;
  pppLabel?: string;
  savingsHint?: boolean;
};

export function PricingCountrySelector({ countryCode, pppLabel }: Props) {
  const queryClient = useQueryClient();

  const setCountry = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch('/api/pricing/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: code }),
      });
      if (!res.ok) throw new Error('Failed to update region');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-plans'] });
      queryClient.invalidateQueries({ queryKey: ['landing-pricing-plans'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-location'] });
    },
  });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-muted-foreground">
      <span>Pricing for</span>
      <Select
        value={countryCode}
        onValueChange={(value) => setCountry.mutate(value)}
        disabled={setCountry.isPending}
      >
        <SelectTrigger className="w-[200px] h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PPP_COUNTRY_OPTIONS.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pppLabel && (
        <span className="text-xs text-muted-foreground/80">({pppLabel})</span>
      )}
    </div>
  );
}
