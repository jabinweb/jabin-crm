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
    question: 'How do CRM and support modules work?',
    answer:
      'Plans define which modules are enabled — leads, deals, tickets, live chat, and more. Usage limits apply to leads, emails sent, and campaigns on the billing account.',
  },
  {
    question: 'Can employees use the app without a CRM plan?',
    answer:
      'Yes. Employees sign in to your company slug for attendance, leave, and payslips. Leads in the employee app require the Leads module on your plan.',
  },
  {
    question: 'Do customers get a portal?',
    answer:
      'Yes. Customers can open tickets, browse the knowledge base when enabled, and use live chat when your plan includes it.',
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
    <section id="faq" className="border-t border-neutral-200 bg-neutral-50/50">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-medium tracking-widest uppercase text-neutral-400 mb-3">
              FAQ
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-neutral-950">
              Questions about {brand.appName}
            </h2>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden">
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <div key={faq.question}>
                  <button
                    type="button"
                    className="w-full px-6 py-4 flex items-start justify-between gap-4 text-left hover:bg-neutral-50/80 transition-colors"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                  >
                    <span className="text-sm font-medium text-neutral-900">{faq.question}</span>
                    <span className="text-neutral-300 text-sm tabular-nums flex-shrink-0 mt-0.5">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-4 -mt-1">
                      <p className="text-sm text-neutral-500 leading-relaxed">{faq.answer}</p>
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
