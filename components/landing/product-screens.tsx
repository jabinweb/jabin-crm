'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { getClientBrandConfig } from '@/lib/branding';

const tabs = [
  { id: 'home', label: 'Home' },
  { id: 'ticket', label: 'Ticket + SLA' },
  { id: 'amc', label: 'AMC renewals' },
] as const;

type TabId = (typeof tabs)[number]['id'];

function Chrome({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="rounded-2xl border border-[var(--lp-line)] bg-white shadow-xl shadow-slate-900/5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--lp-line)] bg-[var(--lp-bg)]">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        </span>
        <span className="text-[11px] text-[var(--lp-muted)] ml-2 truncate">{title}</span>
      </div>
      {children}
    </div>
  );
}

function HomeScreen() {
  return (
    <div className="p-4 sm:p-6 space-y-4 bg-stone-50/80 min-h-[320px]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-[var(--lp-ink)]">Home</p>
          <p className="text-xs text-[var(--lp-muted)]">What needs attention today</p>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-1 rounded">
          Live
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { l: 'Open tickets', v: '24' },
          { l: 'SLA on track', v: '94%' },
          { l: 'At risk', v: '3' },
          { l: 'AMC due', v: '7' },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-[var(--lp-line)] bg-white p-3">
            <p className="text-[10px] text-[var(--lp-muted)]">{s.l}</p>
            <p className="text-xl font-semibold tabular-nums mt-0.5">{s.v}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 space-y-2">
        <p className="text-xs font-semibold text-amber-900">Contract renewals</p>
        {[
          { t: 'AMC — Main plant chillers', d: '12d left' },
          { t: 'CMC — Site B compressors', d: '3d left' },
        ].map((r) => (
          <div
            key={r.t}
            className="flex justify-between gap-2 text-xs bg-white/80 rounded-lg border border-amber-100 px-3 py-2"
          >
            <span className="truncate text-[var(--lp-ink)]">{r.t}</span>
            <span className="text-amber-800 shrink-0 tabular-nums">{r.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TicketScreen() {
  return (
    <div className="p-4 sm:p-6 space-y-4 bg-stone-50/80 min-h-[320px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono text-[var(--lp-muted)]">TK-1842</p>
          <p className="text-base font-semibold text-[var(--lp-ink)] mt-0.5">
            Chiller calibration — Plant 2
          </p>
          <p className="text-xs text-[var(--lp-muted)] mt-1">Apollo Hospitals · High</p>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wider text-rose-700">Resolution due</p>
          <p className="text-sm font-semibold tabular-nums text-rose-800">2h 14m</p>
        </div>
      </div>
      <div className="rounded-xl border border-[var(--lp-line)] bg-white p-4 space-y-3">
        <p className="text-xs font-medium text-[var(--lp-ink)]">Activity</p>
        {[
          { who: 'System', what: 'SLA timer started', when: '08:12' },
          { who: 'Arjun K.', what: 'Assigned · En route', when: '08:40' },
          { who: 'Client', what: 'Added photo of unit', when: '09:05' },
        ].map((a) => (
          <div key={a.when} className="flex gap-3 text-xs border-t border-[var(--lp-line)] pt-2 first:border-0 first:pt-0">
            <span className="tabular-nums text-[var(--lp-muted)] w-10 shrink-0">{a.when}</span>
            <span>
              <span className="font-medium text-[var(--lp-ink)]">{a.who}</span>
              <span className="text-[var(--lp-muted)]"> — {a.what}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AmcScreen() {
  return (
    <div className="p-4 sm:p-6 space-y-4 bg-stone-50/80 min-h-[320px]">
      <div>
        <p className="text-lg font-semibold text-[var(--lp-ink)]">AMC / CMC</p>
        <p className="text-xs text-[var(--lp-muted)]">Sorted by end date — renewals first</p>
      </div>
      <div className="rounded-xl border border-[var(--lp-line)] bg-white overflow-hidden divide-y divide-[var(--lp-line)]">
        {[
          { type: 'AMC', title: 'Main plant chillers', client: 'FoodCorp', left: '12d', tone: 'text-amber-700' },
          { type: 'CMC', title: 'Site B compressors', client: 'TechPark', left: '3d', tone: 'text-rose-700' },
          { type: 'AMC', title: 'OT generators', client: 'City Hospital', left: '45d', tone: 'text-[var(--lp-muted)]' },
        ].map((c) => (
          <div key={c.title} className="flex items-center gap-3 px-4 py-3 text-xs">
            <span className="rounded border border-[var(--lp-line)] px-1.5 py-0.5 font-medium text-[var(--lp-ink)]">
              {c.type}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[var(--lp-ink)] truncate">{c.title}</p>
              <p className="text-[var(--lp-muted)] truncate">{c.client}</p>
            </div>
            <span className={cn('tabular-nums shrink-0 font-medium', c.tone)}>{c.left}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductScreens() {
  const brand = getClientBrandConfig();
  const [tab, setTab] = useState<TabId>('home');

  return (
    <section id="product" className="border-t border-[var(--lp-line)] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-2xl mb-10">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--lp-accent)] mb-3">
            Product
          </p>
          <h2 className="font-[family-name:var(--font-landing-display)] text-3xl md:text-4xl font-semibold tracking-tight text-[var(--lp-ink)]">
            See {brand.appName} the way your team will
          </h2>
          <p className="mt-4 text-[var(--lp-muted)] leading-relaxed">
            Home shows risk first. Tickets carry SLA timers. Contracts surface renewals before
            coverage ends.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                tab === t.id
                  ? 'bg-[var(--lp-ink)] text-white'
                  : 'bg-[var(--lp-bg)] text-[var(--lp-muted)] hover:text-[var(--lp-ink)]'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Chrome title={`${brand.appName.toLowerCase()} · ${tab}`}>
          {tab === 'home' && <HomeScreen />}
          {tab === 'ticket' && <TicketScreen />}
          {tab === 'amc' && <AmcScreen />}
        </Chrome>
      </div>
    </section>
  );
}
