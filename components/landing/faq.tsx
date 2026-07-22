'use client';

import { useState } from 'react';
import { getClientBrandConfig } from '@/lib/branding';

const faqs = [
  {
    question: 'What is included on every plan?',
    answer:
      'Every approved company workspace gets HRMS: employee attendance, leave requests, payslips, and admin payroll tools. CRM and customer-support modules depend on your subscription tier.',
  },
  {
    question: 'How fast can we go live?',
    answer:
      'Self-serve: create a workspace, finish a short admin setup (or skip it), then use the Home checklist to add a client, ticket, and teammate. Most teams are productive the same day.',
  },
  {
    question: 'Do we get SLA and AMC tools?',
    answer:
      'Yes. Tickets show response and resolution timers. AMC/CMC contracts surface renewals on Home so coverage does not lapse quietly.',
  },
  {
    question: 'Do customers get a portal?',
    answer:
      'Yes. Customers can open tickets, browse the knowledge base when enabled, and use live chat when your plan includes it. QR service links let sites raise requests without logging in.',
  },
  {
    question: 'Why choose this pricing?',
    answer:
      'You get competitive rates, the most complete feature pack for service ops (CRM, tickets, field, AMC, HRMS), and dedicated support — without paying for seats you do not need. Prices show in your local currency where available; checkout settles securely via Razorpay.',
  },
  {
    question: 'Can I change plans later?',
    answer:
      'Yes. Upgrade or downgrade from dashboard settings or the pricing page. Module access updates with the new plan.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const brand = getClientBrandConfig();

  return (
    <section id="faq" className="border-t border-[var(--lp-line)] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--lp-accent)] mb-3">
              FAQ
            </p>
            <h2 className="font-[family-name:var(--font-landing-display)] text-3xl md:text-4xl font-semibold tracking-tight text-[var(--lp-ink)]">
              Common questions about {brand.appName}
            </h2>
          </div>

          <div className="rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-bg)] divide-y divide-[var(--lp-line)] overflow-hidden">
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <div key={faq.question}>
                  <button
                    type="button"
                    className="w-full px-6 py-4 flex items-start justify-between gap-4 text-left hover:bg-white/60 transition-colors"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                  >
                    <span className="text-sm font-medium text-[var(--lp-ink)]">{faq.question}</span>
                    <span className="text-[var(--lp-muted)] text-sm tabular-nums flex-shrink-0 mt-0.5">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-4 -mt-1">
                      <p className="text-sm text-[var(--lp-muted)] leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
