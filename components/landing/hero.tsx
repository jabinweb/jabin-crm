'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowUpRight } from 'lucide-react';
import { getClientBrandConfig } from '@/lib/branding';

export function LandingHero() {
  const brand = getClientBrandConfig();

  return (
    <section className="relative overflow-hidden pt-16 min-h-[100svh] flex flex-col">
      {/* Atmosphere — full-bleed plane */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 70% 20%, rgba(13, 148, 136, 0.18), transparent 55%),
            radial-gradient(ellipse 50% 40% at 10% 80%, rgba(15, 23, 42, 0.06), transparent 50%),
            linear-gradient(165deg, #e8eef2 0%, #f4f6f8 45%, #dfe8e6 100%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-6 flex-1 flex flex-col justify-center py-16 md:py-20">
        <div className="grid lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-10 items-center">
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-700">
            <p className="font-[family-name:var(--font-landing-display)] text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--lp-ink)] mb-6">
              {brand.appName}
            </p>

            <h1 className="font-[family-name:var(--font-landing-display)] text-4xl sm:text-5xl lg:text-[3.25rem] font-semibold tracking-tight text-[var(--lp-ink)] leading-[1.08] max-w-xl">
              One workspace. Clear enough for anyone on the team.
            </h1>

            <p className="mt-5 text-base sm:text-lg text-[var(--lp-muted)] leading-relaxed max-w-md">
              Sales, tickets, field work, and renewals — without a week of training. Admins set
              up once; technicians and clients just get work done.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                className="h-11 px-6 bg-[var(--lp-accent)] hover:bg-[var(--lp-accent-deep)] text-white text-sm font-medium shadow-sm"
              >
                <Link href="/start">
                  Start free trial
                  <ArrowUpRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 px-6 text-sm font-medium border-slate-300 bg-white/70 backdrop-blur-sm text-[var(--lp-ink)] hover:bg-white"
              >
                <Link href="#product">See the product</Link>
              </Button>
            </div>
          </div>

          {/* Dominant product visual */}
          <div className="relative animate-in fade-in slide-in-from-right-4 duration-1000 delay-150">
            <div className="rounded-2xl border border-slate-200/80 bg-[var(--lp-night)] shadow-2xl shadow-slate-900/20 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/5">
                <span className="text-[11px] font-medium text-slate-400 tracking-wide">
                  {brand.appName.toLowerCase().replace(/\s+/g, '')}.workspace
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-teal-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-400" />
                  </span>
                  Live
                </span>
              </div>
              <div className="p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { label: 'Open tickets', value: '24', delta: '+3 today' },
                    { label: 'SLA on track', value: '94%', delta: '+1.3%' },
                    { label: 'AMC due', value: '7', delta: '60 days' },
                    { label: 'Agents', value: '18', delta: '4 idle' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5"
                    >
                      <p className="text-[10px] text-slate-400 truncate">{stat.label}</p>
                      <p className="mt-0.5 text-xl font-semibold tabular-nums text-white tracking-tight">
                        {stat.value}
                      </p>
                      <p className="text-[10px] text-teal-400/90 mt-0.5">{stat.delta}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/10 bg-white/[0.03]">
                    <span>ID</span>
                    <span>Issue</span>
                    <span>SLA</span>
                  </div>
                  {[
                    {
                      id: 'TK-1842',
                      title: 'Chiller calibration — Plant 2',
                      sla: '2h 14m',
                      tone: 'text-rose-400',
                    },
                    {
                      id: 'TK-1839',
                      title: 'Sensor replacement — Line B',
                      sla: '5h 30m',
                      tone: 'text-amber-400',
                    },
                    {
                      id: 'TK-1836',
                      title: 'Monthly PM — Unit C',
                      sla: '1 day',
                      tone: 'text-slate-400',
                    },
                  ].map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[auto_1fr_auto] gap-x-3 px-3 py-2.5 text-xs border-b border-white/5 last:border-0 items-center"
                    >
                      <span className="font-mono text-[10px] text-slate-500">{row.id}</span>
                      <span className="text-slate-200 truncate">{row.title}</span>
                      <span className={`tabular-nums text-[11px] ${row.tone}`}>{row.sla}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Below-fold trust strip still in hero section but visually secondary */}
      <div className="relative border-t border-slate-200/60 bg-white/40 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          {[
            { value: 'Simple', label: 'Plain language, not IT jargon' },
            { value: 'Self-serve', label: 'Live in minutes, no sales call' },
            { value: 'SLA & AMC', label: 'Timers and renewals on Home' },
            { value: 'For everyone', label: 'Admin, tech, sales, clients' },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-sm font-semibold text-[var(--lp-ink)]">{item.value}</p>
              <p className="text-xs text-[var(--lp-muted)] mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
