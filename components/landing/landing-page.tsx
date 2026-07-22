'use client';

import type { CSSProperties } from 'react';
import { LandingHeader } from './header';
import { LandingHero } from './hero';
import { IndustryStrip } from './industries';
import { ProductScreens } from './product-screens';
import { ProblemSection } from './problem';
import { Features } from './features';
import { RolePaths } from './roles';
import { Transformation } from './transformation';
import { TrustSection } from './trust';
import { HowItWorks } from './how-it-works';
import { Pricing } from './pricing';
import { FAQ } from './faq';
import { FinalCta } from './final-cta';
import { LandingFooter } from './footer';
import { StickyMobileCta } from './sticky-mobile-cta';
import { cn } from '@/lib/utils';

export function LandingPage() {
  return (
    <div
      className={cn(
        'min-h-screen antialiased text-[var(--lp-ink)] selection:bg-[var(--lp-accent)] selection:text-white',
        'bg-[var(--lp-bg)] font-[family-name:var(--font-landing-sans)] pb-20 md:pb-0'
      )}
      style={
        {
          '--lp-bg': '#f4f6f8',
          '--lp-ink': '#0f172a',
          '--lp-muted': '#64748b',
          '--lp-accent': '#0d9488',
          '--lp-accent-deep': '#0f766e',
          '--lp-surface': '#ffffff',
          '--lp-line': '#e2e8f0',
          '--lp-night': '#0b1220',
        } as CSSProperties
      }
    >
      <LandingHeader />
      <main>
        <LandingHero />
        <IndustryStrip />
        <ProductScreens />
        <ProblemSection />
        <Features />
        <RolePaths />
        <Transformation />
        <TrustSection />
        <HowItWorks />
        <Pricing />
        <FAQ />
        <FinalCta />
      </main>
      <LandingFooter />
      <StickyMobileCta />
    </div>
  );
}
