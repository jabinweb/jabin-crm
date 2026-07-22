'use client';

import { getClientBrandConfig } from '@/lib/branding';

const highlights = [
  {
    title: 'Command Home',
    description:
      'Open tickets, SLA risk, contract renewals, and recent work — what needs attention today.',
  },
  {
    title: 'Tickets & SLA',
    description:
      'Priority queues with response and resolution timers so breaches are visible before they happen.',
  },
  {
    title: 'Field & equipment',
    description:
      'Installations, QR service links, GPS tools, and service reports for technicians on site.',
  },
  {
    title: 'AMC / CMC',
    description:
      'Track maintenance contracts and surface renewals on Home before coverage lapses.',
  },
];

const modules = [
  {
    title: 'Sales & outreach',
    items: ['Leads & deals', 'Quotations & invoices', 'Email sequences', 'Campaigns', 'WhatsApp'],
  },
  {
    title: 'Service operations',
    items: ['Tickets', 'SLA policies', 'Omnichannel inbox', 'Knowledge base', 'Client portal'],
  },
  {
    title: 'People & field',
    items: ['Attendance', 'Leave & payroll', 'Technician app', 'GPS tracking', 'Expenses'],
  },
];

export function Features() {
  const brand = getClientBrandConfig();

  return (
    <>
      <section id="platform" className="border-t border-[var(--lp-line)] bg-[var(--lp-bg)]">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--lp-accent)] mb-3">
              Platform overview
            </p>
            <h2 className="font-[family-name:var(--font-landing-display)] text-3xl md:text-4xl font-semibold tracking-tight text-[var(--lp-ink)]">
              Full operations — without the complexity tax
            </h2>
            <p className="mt-4 text-[var(--lp-muted)] leading-relaxed">
              {brand.appName} covers the same jobs as heavier platforms: queues, renewals,
              field, sales, and portal. The difference is shorter paths and clearer screens.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {highlights.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[var(--lp-line)] bg-white p-6 hover:border-teal-200/80 transition-colors"
              >
                <h3 className="font-[family-name:var(--font-landing-display)] text-lg font-semibold text-[var(--lp-ink)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--lp-muted)] leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="modules" className="border-t border-[var(--lp-line)] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="max-w-xl mb-12">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--lp-accent)] mb-3">
              Core modules
            </p>
            <h2 className="font-[family-name:var(--font-landing-display)] text-3xl md:text-4xl font-semibold tracking-tight text-[var(--lp-ink)]">
              Replace disconnected tools with one stack
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {modules.map((mod) => (
              <div
                key={mod.title}
                className="rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-bg)] p-6"
              >
                <h3 className="font-[family-name:var(--font-landing-display)] text-base font-semibold text-[var(--lp-ink)]">
                  {mod.title}
                </h3>
                <ul className="mt-4 space-y-2">
                  {mod.items.map((item) => (
                    <li
                      key={item}
                      className="text-sm text-[var(--lp-muted)] flex items-center gap-2"
                    >
                      <span className="h-1 w-1 rounded-full bg-[var(--lp-accent)] shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
