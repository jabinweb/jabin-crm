const steps = [
  {
    n: '01',
    title: 'Create your workspace',
    body: 'Company name, URL, and industry — configured for how you operate.',
  },
  {
    n: '02',
    title: 'Create your admin account',
    body: 'Work email and password. No credit card. You are the workspace admin.',
  },
  {
    n: '03',
    title: 'Land on Home',
    body: 'Add a client, open a ticket, invite a teammate from the Getting started checklist.',
  },
  {
    n: '04',
    title: 'Run the business',
    body: 'Tickets, SLA, field tools, and AMC renewals — ready when you are.',
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-[var(--lp-line)] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--lp-accent)] mb-3">
            Self-serve onboarding
          </p>
          <h2 className="font-[family-name:var(--font-landing-display)] text-3xl md:text-4xl font-semibold tracking-tight text-[var(--lp-ink)]">
            Live in about 90 seconds
          </h2>
        </div>

        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step) => (
            <li
              key={step.n}
              className="rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-bg)] p-5"
            >
              <span className="font-mono text-xs text-[var(--lp-accent)]">{step.n}</span>
              <h3 className="mt-2 font-[family-name:var(--font-landing-display)] text-base font-semibold text-[var(--lp-ink)]">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-[var(--lp-muted)] leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
