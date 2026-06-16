import { LandingHeader } from './header';
import { LandingHero } from './hero';
import { Features } from './features';
import { Pricing } from './pricing';
import { FAQ } from './faq';
import { LandingFooter } from './footer';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-950 antialiased selection:bg-neutral-900 selection:text-white">
      <LandingHeader />
      <main>
        <LandingHero />
        <Features />
        <Pricing />
        <FAQ />
      </main>
      <LandingFooter />
    </div>
  );
}
