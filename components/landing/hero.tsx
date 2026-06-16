'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowUpRight } from 'lucide-react';
import { getClientBrandConfig } from '@/lib/branding';

export function LandingHero() {
  const brand = getClientBrandConfig();

  return (
    <section className="pt-28 pb-20 md:pt-36 md:pb-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          <div>
            <p className="text-xs font-medium tracking-widest uppercase text-neutral-400 mb-5">
              CRM · HRMS · Support
            </p>

            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-neutral-950 leading-[1.1]">
              One workspace for revenue, people, and customers.
            </h1>

            <p className="mt-5 text-base text-neutral-500 leading-relaxed max-w-md">
              {brand.appName} brings sales pipelines, employee HR, and support desks together.
              CRM modules scale with your plan — HR is included for every company.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                className="h-10 px-5 bg-neutral-950 hover:bg-neutral-800 text-sm font-medium"
              >
                <Link href="/auth/signin?callbackUrl=/pricing">
                  Get started
                  <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-10 px-5 text-sm font-medium border-neutral-300 text-neutral-600 hover:bg-neutral-50"
              >
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>

          <div className="relative lg:pl-4">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-1.5">
              <div className="rounded-xl bg-white border border-neutral-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100">
                  <span className="text-xs font-medium text-neutral-400">{brand.appName}</span>
                  <span className="text-xs text-neutral-300">workspace</span>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Open leads', value: '128' },
                      { label: 'On leave', value: '4' },
                      { label: 'Open tickets', value: '23' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-lg border border-neutral-100 px-3 py-3">
                        <p className="text-lg font-semibold tabular-nums text-neutral-900">{stat.value}</p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-neutral-100 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-500">Pipeline</span>
                      <span className="text-xs text-neutral-300">This month</span>
                    </div>
                    <div className="flex items-end gap-1.5 h-16">
                      {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm bg-neutral-100"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {['Deal closed — Acme Corp', 'Leave approved — Priya S.', 'Ticket #1042 resolved'].map(
                      (line) => (
                        <div
                          key={line}
                          className="flex items-center gap-3 text-xs text-neutral-500 py-1.5 border-b border-neutral-50 last:border-0"
                        >
                          <span className="w-1 h-1 rounded-full bg-neutral-300 flex-shrink-0" />
                          {line}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
