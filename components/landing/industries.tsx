import { BUSINESS_VERTICAL_OPTIONS } from '@/lib/workspace-templates';

/** Landing strip — mirrors workspace industry templates. */
export const LANDING_INDUSTRIES = BUSINESS_VERTICAL_OPTIONS.map((o) => o.label);

export function IndustryStrip() {
  return (
    <section className="border-t border-[var(--lp-line)] bg-[var(--lp-bg)]">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-14">
        <p className="text-center text-xs font-semibold tracking-[0.2em] uppercase text-[var(--lp-muted)] mb-6">
          Built for every industry
        </p>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {LANDING_INDUSTRIES.map((name) => (
            <span
              key={name}
              className="rounded-full border border-[var(--lp-line)] bg-white px-4 py-2 text-sm text-[var(--lp-ink)]"
            >
              {name}
            </span>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-[var(--lp-muted)] max-w-lg mx-auto">
          Pick your industry at signup — terminology, ticket types, and workspace defaults follow.
        </p>
      </div>
    </section>
  );
}
