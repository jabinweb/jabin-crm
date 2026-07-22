'use client';

import Link from 'next/link';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { PricingCountrySelector } from '@/components/pricing/pricing-country-selector';

const tierSummary: Record<string, { tagline: string; modules: string }> = {
  free: { tagline: 'Try it free', modules: 'Leads, basic tickets, HRMS' },
  starter: { tagline: 'Growing teams', modules: 'Deals, chat, inventory, email' },
  professional: {
    tagline: 'Most popular',
    modules: 'SLA, field, AMC, WhatsApp — full ops',
  },
  enterprise: {
    tagline: 'Unlimited',
    modules: 'Unlimited usage · every module',
  },
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
    refetchOnWindowFocus: false,
  });

  const plans = pricingData?.plans ?? [];
  const location = pricingData?.location;
  const firstPlan = plans[0];
  const pppLabel = firstPlan?.pppLabel as string | undefined;

  return (
    <section id="pricing" className="border-t border-[var(--lp-line)] bg-[var(--lp-bg)]">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
          <div className="max-w-lg">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--lp-accent)] mb-3">
              Pricing
            </p>
            <h2 className="font-[family-name:var(--font-landing-display)] text-3xl md:text-4xl font-semibold tracking-tight text-[var(--lp-ink)]">
              Lowest pricing. Most complete pack.
            </h2>
            <p className="mt-3 text-sm text-[var(--lp-muted)] leading-relaxed">
              Competitive rates with the features you need — CRM, field service, AMC, and HRMS —
              plus dedicated support. Pick a plan and go live.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="h-9 px-4 text-xs border-slate-300 text-[var(--lp-muted)] shrink-0 self-start md:self-auto bg-white"
          >
            <Link href="/pricing">
              Full comparison
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {location?.countryCode && (
          <div className="mb-10">
            <PricingCountrySelector
              countryCode={location.countryCode}
              pppLabel={pppLabel}
            />
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--lp-muted)]" />
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-2xl border border-[var(--lp-line)] bg-white p-10 text-center">
            <p className="text-sm text-[var(--lp-muted)] mb-4">Plans are configured in admin.</p>
            <Button asChild className="h-9 text-xs bg-[var(--lp-accent)] hover:bg-[var(--lp-accent-deep)]">
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--lp-line)] overflow-hidden bg-white">
            <div className="hidden md:grid md:grid-cols-[1.2fr_1fr_1.5fr_auto] gap-4 px-6 py-3 bg-[var(--lp-bg)] border-b border-[var(--lp-line)] text-[11px] font-medium tracking-wide uppercase text-[var(--lp-muted)]">
              <span>Plan</span>
              <span>Price ({location?.currency ?? 'local'})</span>
              <span>Includes</span>
              <span className="w-20" />
            </div>
            {plans.map(
              (
                plan: {
                  id: string;
                  name: string;
                  displayName?: string;
                  price: number;
                  formattedPrice?: string;
                  savingsPercent?: number | null;
                  formattedBasePrice?: string;
                  interval?: string;
                },
                i: number
              ) => {
                const key = plan.name?.toLowerCase() ?? 'free';
                const summary = tierSummary[key] ?? tierSummary.free;
                const featured = key === 'professional';
                const priceLabel = plan.price === 0 ? 'Free' : (plan.formattedPrice ?? '—');

                return (
                  <div
                    key={plan.id}
                    className={`px-6 py-5 ${i > 0 ? 'border-t border-[var(--lp-line)]' : ''} ${
                      featured ? 'bg-teal-50/40' : 'bg-white'
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:grid md:grid-cols-[1.2fr_1fr_1.5fr_auto] md:gap-4 md:items-center">
                      <div className="flex items-start justify-between gap-4 md:block">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[var(--lp-ink)] capitalize">
                              {plan.displayName || plan.name}
                            </span>
                            {featured && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--lp-accent)]">
                                Popular
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--lp-muted)] mt-0.5">{summary.tagline}</p>
                        </div>
                        <div className="text-sm font-medium text-[var(--lp-ink)] tabular-nums md:hidden shrink-0 text-right">
                          {priceLabel}
                          {plan.price > 0 && (
                            <span className="text-xs font-normal text-[var(--lp-muted)]">
                              /{plan.interval || 'mo'}
                            </span>
                          )}
                          {plan.savingsPercent != null && plan.savingsPercent > 0 && (
                            <p className="text-[10px] text-emerald-700 font-normal mt-0.5">
                              {plan.savingsPercent}% off list
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="hidden md:block text-sm font-medium text-[var(--lp-ink)] tabular-nums">
                        {priceLabel}
                        {plan.price > 0 && (
                          <span className="text-xs font-normal text-[var(--lp-muted)]">
                            /{plan.interval || 'mo'}
                          </span>
                        )}
                        {plan.savingsPercent != null && plan.savingsPercent > 0 && (
                          <p className="text-[10px] text-emerald-700 font-normal mt-0.5">
                            {plan.savingsPercent}% off
                            {plan.formattedBasePrice ? (
                              <>
                                {' '}
                                · <span className="line-through">{plan.formattedBasePrice}</span>
                              </>
                            ) : null}
                          </p>
                        )}
                      </div>

                      <p className="text-xs text-[var(--lp-muted)] leading-relaxed">
                        {summary.modules}
                        <span className="text-slate-300 mx-1.5">·</span>
                        HRMS included
                      </p>

                      <Button
                        asChild
                        size="sm"
                        variant={featured ? 'default' : 'outline'}
                        className={`h-8 px-3 text-xs w-full md:w-20 ${
                          featured
                            ? 'bg-[var(--lp-accent)] hover:bg-[var(--lp-accent-deep)]'
                            : 'border-slate-300 text-[var(--lp-muted)]'
                        }`}
                      >
                        <Link href="/pricing">Select</Link>
                      </Button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </section>
  );
}
