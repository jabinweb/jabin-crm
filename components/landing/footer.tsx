import Link from 'next/link';
import { getBrandConfig } from '@/lib/branding';

export function LandingFooter() {
  const brand = getBrandConfig();

  const links = [
    { name: 'Features', href: '/#features' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Sign in', href: '/auth/signin' },
    { name: 'Workspace', href: '/workspace' },
    { name: 'Portal', href: '/portal' },
  ];

  return (
    <footer id="contact" className="border-t border-neutral-200">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div>
            <p className="text-sm font-semibold text-neutral-950">{brand.appName}</p>
            <p className="mt-1 text-xs text-neutral-500 max-w-xs">
              CRM, HRMS, and customer support for modern companies.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-xs text-neutral-500 hover:text-neutral-950 transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-10 pt-6 border-t border-neutral-200 text-xs text-neutral-400">
          © {new Date().getFullYear()} {brand.appName}
        </div>
      </div>
    </footer>
  );
}
