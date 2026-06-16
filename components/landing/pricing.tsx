'use client';

import Link from 'next/link';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';

const tierSummary: Record<string, { tagline: string; modules: string }> = {
  free: { tagline: 'Get started', modules: 'Leads, email, basic tickets' },
  starter: { tagline: 'Growing teams', modules: 'Deals, live chat, knowledge base' },
  professional: { tagline: 'Full stack', modules: 'Most CRM & support modules' },
  enterprise: { tagline: 'No limits', modules: 'All modules, highest quotas' },
};

export function Pricing() {
  const { data: pricingData, isLoading } = useQuery({
    queryKey: ['landing-pricing-plans'],
    queryFn: async () => {
      const res = await fetch('/api/pricing/plans');
      if (!res.ok) throw new Error('Failed to load plans');
      return res.json();
    },
    staleTime: 60_000,
  });

  const plans = pricingData?.plans ?? [];
  const location = pricingData?.location;

  return (
    <section id="pricing" className="border-t border-neutral-200">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="max-w-lg">
            <p className="text-xs font-medium tracking-widest uppercase text-neutral-400 mb-3">
              Pricing
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-neutral-950">
              Simple plans. HRMS always included.
            </h2>
            <p className="mt-3 text-sm text-neutral-500 leading-relaxed">
              CRM and support modules unlock by tier. Prices in{' '}
              {location?.currency ?? 'your local currency'} with purchase power parity
              {location?.countryCode ? ` (${location.countryCode})` : ''}.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="h-9 px-4 text-xs border-neutral-300 text-neutral-600 shrink-0 self-start md:self-auto"
          >
            <Link href="/pricing">
              Full comparison
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-10 text-center">
            <p className="text-sm text-neutral-500 mb-4">Plans are configured in admin.</p>
            <Button asChild className="h-9 text-xs bg-neutral-950 hover:bg-neutral-800">
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-200 overflow-hidden">
            <div className="hidden md:grid md:grid-cols-[1.2fr_1fr_1.5fr_auto] gap-4 px-6 py-3 bg-neutral-50 border-b border-neutral-200 text-[11px] font-medium tracking-wide uppercase text-neutral-400">
              <span>Plan</span>
              <span>Price ({location?.currency ?? 'local'})</span>
              <span>Includes</span>
              <span className="w-20" />
            </div>
            {plans.map((plan: {
              id: string;
              name: string;
              displayName?: string;
              price: number;
              formattedPrice?: string;
              savingsPercent?: number | null;
              interval?: string;
            }, i: number) => {
              const key = plan.name?.toLowerCase() ?? 'free';
              const summary = tierSummary[key] ?? tierSummary.free;
              const featured = key === 'professional';
              const priceLabel = plan.price === 0 ? 'Free' : (plan.formattedPrice ?? '—');

              return (
                <div
                  key={plan.id}
                  className={`px-6 py-5 ${
                    i > 0 ? 'border-t border-neutral-100' : ''
                  } ${featured ? 'bg-neutral-50/80' : 'bg-white'}`}
                >
                  <div className="flex flex-col gap-4 md:grid md:grid-cols-[1.2fr_1fr_1.5fr_auto] md:gap-4 md:items-center">
                    <div className="flex items-start justify-between gap-4 md:block">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-neutral-950 capitalize">
                            {plan.displayName || plan.name}
                          </span>
                          {featured && (
                            <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">{summary.tagline}</p>
                      </div>
                      <div className="text-sm font-medium text-neutral-950 tabular-nums md:hidden shrink-0 text-right">
                        {priceLabel}
                        {plan.price > 0 && (
                          <span className="text-xs font-normal text-neutral-400">/{plan.interval || 'mo'}</span>
                        )}
                        {plan.savingsPercent != null && plan.savingsPercent > 0 && (
                          <p className="text-[10px] text-emerald-600 font-normal">−{plan.savingsPercent}% PPP</p>
                        )}
                      </div>
                    </div>

                    <div className="hidden md:block text-sm font-medium text-neutral-950 tabular-nums">
                      {priceLabel}
                      {plan.price > 0 && (
                        <span className="text-xs font-normal text-neutral-400">/{plan.interval || 'mo'}</span>
                      )}
                      {plan.savingsPercent != null && plan.savingsPercent > 0 && (
                        <p className="text-[10px] text-emerald-600 font-normal mt-0.5">−{plan.savingsPercent}% PPP</p>
                      )}
                    </div>

                    <p className="text-xs text-neutral-500 leading-relaxed">
                      {summary.modules}
                      <span className="text-neutral-300 mx-1.5">·</span>
                      HRMS included
                    </p>

                    <Button
                      asChild
                      size="sm"
                      variant={featured ? 'default' : 'outline'}
                      className={`h-8 px-3 text-xs w-full md:w-20 ${
                        featured
                          ? 'bg-neutral-950 hover:bg-neutral-800'
                          : 'border-neutral-300 text-neutral-600'
                      }`}
                    >
                      <Link href="/pricing">Select</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 rounded-xl border border-neutral-200 bg-neutral-950 text-white px-8 py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <p className="text-base font-medium">Ready to get started?</p>
            <p className="mt-1 text-sm text-neutral-400">
              Sign in, pick a plan, and set up your company workspace.
            </p>
          </div>
          <Button
            asChild
            className="h-10 px-5 bg-white text-neutral-950 hover:bg-neutral-100 text-sm font-medium shrink-0"
          >
            <Link href="/auth/signin?callbackUrl=/pricing">
              Get started
              <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
