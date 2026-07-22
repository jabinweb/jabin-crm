const rows = [
  { before: 'Manual reports, weekly lag', after: 'Live Home with SLA and renewals' },
  { before: 'Tickets lost in WhatsApp & email', after: 'One queue with timers and portal' },
  { before: 'AMC dates in spreadsheets', after: 'Contract alerts before coverage ends' },
  { before: 'Field updates by phone call', after: 'Technician app, GPS, service reports' },
  { before: 'Sales disconnected from service', after: 'Leads → clients → equipment → tickets' },
];

export function Transformation() {
  return (
    <section className="border-t border-[var(--lp-line)] bg-[var(--lp-night)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-teal-400 mb-3">
            The transformation
          </p>
          <h2 className="font-[family-name:var(--font-landing-display)] text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
            Before vs. after a command center
          </h2>
        </div>

        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-2 text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/10 bg-white/[0.03]">
            <div className="px-5 py-3">Before</div>
            <div className="px-5 py-3 text-teal-400/80">With your workspace</div>
          </div>
          {rows.map((row) => (
            <div
              key={row.before}
              className="grid grid-cols-1 sm:grid-cols-2 border-b border-white/5 last:border-0"
            >
              <div className="px-5 py-4 text-sm text-slate-400 line-through decoration-slate-600">
                {row.before}
              </div>
              <div className="px-5 py-4 text-sm text-slate-100 border-t sm:border-t-0 sm:border-l border-white/5">
                {row.after}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
