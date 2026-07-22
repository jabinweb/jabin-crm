'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { getClientBrandConfig } from '@/lib/branding';
import { resolvePostLoginPath } from '@/lib/auth/post-login-path';

const navigation = [
  { name: 'Product', href: '#product' },
  { name: 'Platform', href: '#platform' },
  { name: 'Pricing', href: '#pricing' },
  { name: 'FAQ', href: '#faq' },
];

export function LandingHeader() {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const brand = getClientBrandConfig();
  const dashboardHref = session?.user
    ? resolvePostLoginPath({
        role: session.user.role,
        companySlug: (session.user as { companySlug?: string }).companySlug,
      })
    : '/workspace';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/85 backdrop-blur-md border-b border-[var(--lp-line)]'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="font-[family-name:var(--font-landing-display)] text-lg font-semibold tracking-tight text-[var(--lp-ink)]"
          >
            {brand.appName}
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm text-[var(--lp-muted)] hover:text-[var(--lp-ink)] transition-colors"
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            {session ? (
              <Button asChild size="sm" className="h-9 px-4 bg-[var(--lp-ink)] hover:bg-slate-800">
                <Link href={dashboardHref}>Open workspace</Link>
              </Button>
            ) : (
              <>
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className="h-9 px-3 text-[var(--lp-muted)]"
                >
                  <Link href="/auth/signin">Sign in</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="h-9 px-4 bg-[var(--lp-accent)] hover:bg-[var(--lp-accent-deep)] text-white"
                >
                  <Link href="/start">Start free</Link>
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            className="md:hidden p-2 -mr-2 text-[var(--lp-muted)]"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Menu"
          >
            {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden border-t border-[var(--lp-line)] pb-4 pt-2 bg-white/95">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block py-2.5 text-sm text-[var(--lp-muted)]"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <div className="pt-3 mt-2 border-t border-[var(--lp-line)] space-y-2">
              {session ? (
                <Button asChild className="w-full h-9 bg-[var(--lp-ink)]" size="sm">
                  <Link href={dashboardHref}>Open workspace</Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild className="w-full h-9" size="sm">
                    <Link href="/auth/signin">Sign in</Link>
                  </Button>
                  <Button
                    asChild
                    className="w-full h-9 bg-[var(--lp-accent)] hover:bg-[var(--lp-accent-deep)]"
                    size="sm"
                  >
                    <Link href="/start">Start free</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
