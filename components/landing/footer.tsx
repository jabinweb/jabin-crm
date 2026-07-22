import Link from 'next/link';
import { getBrandConfig } from '@/lib/branding';

export function LandingFooter() {
  const brand = getBrandConfig();

  const product = [
    { name: 'Start free', href: '/start' },
    { name: 'Product', href: '/#product' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Sign in', href: '/auth/signin' },
  ];

  const legal = [
    { name: 'Privacy', href: '/privacy' },
    { name: 'Terms', href: '/terms' },
    { name: 'Contact', href: 'mailto:hello@opslane.app' },
  ];

  return (
    <footer id="contact" className="border-t border-[var(--lp-line)] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="font-[family-name:var(--font-landing-display)] text-sm font-semibold text-[var(--lp-ink)]">
              {brand.appName}
            </p>
            <p className="mt-2 text-xs text-[var(--lp-muted)] max-w-xs leading-relaxed">
              Service ops that stay simple — sales, tickets, field, and renewals for the whole
              team.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--lp-muted)] mb-3">
              Product
            </p>
            <nav className="flex flex-col gap-2">
              {product.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-sm text-[var(--lp-muted)] hover:text-[var(--lp-ink)] transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--lp-muted)] mb-3">
              Company
            </p>
            <nav className="flex flex-col gap-2">
              {legal.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-sm text-[var(--lp-muted)] hover:text-[var(--lp-ink)] transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[var(--lp-line)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[var(--lp-muted)]">
          <span>© {new Date().getFullYear()} {brand.appName}</span>
          <span>Lowest pricing · full feature pack · dedicated support</span>
        </div>
      </div>
    </footer>
  );
}
