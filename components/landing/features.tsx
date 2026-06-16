const modules = [
  {
    title: 'CRM & revenue',
    description: 'Manage the full sales cycle from first touch to closed deal.',
    items: ['Leads & pipeline', 'Deals & quotations', 'Invoices', 'Email campaigns', 'Sequences', 'WhatsApp'],
  },
  {
    title: 'HRMS',
    description: 'Internal people operations included on every plan — no add-on required.',
    items: ['Attendance', 'Leave requests', 'Payslips', 'Payroll admin', 'Employee app', 'Company workspace'],
  },
  {
    title: 'Customer support',
    description: 'Resolve customer issues across channels with a branded self-service portal.',
    items: ['Ticket desk', 'SLA policies', 'Live chat', 'Knowledge base', 'Omnichannel inbox', 'Customer portal'],
  },
];

export function Features() {
  return (
    <section id="features" className="border-t border-neutral-200 bg-neutral-50/50">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-xl mb-14">
          <p className="text-xs font-medium tracking-widest uppercase text-neutral-400 mb-3">
            Platform
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-neutral-950">
            Everything your company runs on
          </h2>
          <p className="mt-3 text-sm text-neutral-500 leading-relaxed">
            CRM and support unlock by subscription tier. HRMS ships with every approved workspace.
          </p>
        </div>

        <div className="space-y-4">
          {modules.map((mod) => (
            <div
              key={mod.title}
              className="rounded-xl border border-neutral-200 bg-white p-6 md:p-8"
            >
              <div className="grid md:grid-cols-[240px_1fr] gap-6 md:gap-10">
                <div>
                  <h3 className="text-base font-medium text-neutral-950">{mod.title}</h3>
                  <p className="mt-2 text-sm text-neutral-500 leading-relaxed">{mod.description}</p>
                </div>
                <div className="flex flex-wrap gap-2 content-start">
                  {mod.items.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
