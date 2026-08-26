import Link from 'next/link';
import { getBrandConfig } from '@/lib/branding';

export function LandingFooter() {
  const brand = getBrandConfig();

  const product = [
    { name: 'Start free', href: '/start' },
    { name: 'Product', href: '/#product' },
    { name: 'Modules', href: '/#modules' },
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
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-3 md:gap-8">
          <div className="sm:col-span-2 md:col-span-1">
            <p className="font-[family-name:var(--font-landing-display)] text-sm font-semibold text-[var(--lp-ink)]">
              {brand.appName}
            </p>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-[var(--lp-muted)]">
              CRM, projects, tickets, HR, and client portal — one workspace for the whole team.
            </p>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--lp-muted)]">
              Product
            </p>
            <nav className="flex flex-col gap-2">
              {product.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-sm text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-ink)]"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--lp-muted)]">
              Company
            </p>
            <nav className="flex flex-col gap-2">
              {legal.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-sm text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-ink)]"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-[var(--lp-line)] pt-6 text-xs text-[var(--lp-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {brand.appName}
          </span>
          <span className="leading-relaxed">
            Lowest pricing · full feature pack · dedicated support
          </span>
        </div>
      </div>
    </footer>
  );
}
