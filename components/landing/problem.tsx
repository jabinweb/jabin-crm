const silos = [
  'Sales in spreadsheets',
  'Tickets in email & WhatsApp',
  'Attendance in a separate app',
  'AMC renewals tracked manually',
  'Reports assembled weekly',
];

export function ProblemSection() {
  return (
    <section className="border-t border-[var(--lp-line)] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--lp-accent)] mb-3">
            The problem
          </p>
          <h2 className="font-[family-name:var(--font-landing-display)] text-3xl md:text-4xl font-semibold tracking-tight text-[var(--lp-ink)] leading-tight">
            Most service businesses don&apos;t have a system — they have tools.
          </h2>
          <p className="mt-4 text-[var(--lp-muted)] leading-relaxed">
            Fragmented tools create blind spots, missed SLAs, and revenue leakage. Your team
            wastes hours bridging disconnected systems.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-8 items-stretch">
          <ul className="space-y-3">
            {silos.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 rounded-xl border border-[var(--lp-line)] bg-[var(--lp-bg)] px-4 py-3 text-sm text-[var(--lp-ink)]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <div className="rounded-2xl bg-[var(--lp-night)] text-white p-8 flex flex-col justify-center">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-teal-400 mb-3">
              One platform
            </p>
            <p className="font-[family-name:var(--font-landing-display)] text-2xl font-semibold leading-snug">
              Powerful where it counts — simple where people work every day.
            </p>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed">
              Tickets, SLAs, AMC alerts, field tools, and a client portal in one place. Built so
              a new hire can open Home and know what to do next.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
