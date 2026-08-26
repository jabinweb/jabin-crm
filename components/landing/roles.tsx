const roles = [
  {
    title: 'Owners & admins',
    body: 'See open work across sales, projects, tickets, and renewals. Invite the team when ready.',
  },
  {
    title: 'Sales & delivery',
    body: 'Move deals through the pipeline, run project boards, and keep retainers and timesheets in sync.',
  },
  {
    title: 'Support & clients',
    body: 'Tickets, SLA, WhatsApp, and a client portal so requests don’t live only in chat threads.',
  },
];

export function RolePaths() {
  return (
    <section className="border-t border-[var(--lp-line)] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <div className="max-w-xl mb-10">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--lp-accent)] mb-3">
            For every role
          </p>
          <h2 className="font-[family-name:var(--font-landing-display)] text-3xl md:text-4xl font-semibold tracking-tight text-[var(--lp-ink)]">
            Clear enough for anyone on the team
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {roles.map((r) => (
            <div
              key={r.title}
              className="rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-bg)] p-6"
            >
              <h3 className="font-[family-name:var(--font-landing-display)] text-base font-semibold text-[var(--lp-ink)]">
                {r.title}
              </h3>
              <p className="mt-2 text-sm text-[var(--lp-muted)] leading-relaxed">{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
