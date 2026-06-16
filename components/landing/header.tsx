'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { getClientBrandConfig } from '@/lib/branding';

const navigation = [
  { name: 'Features', href: '#features' },
  { name: 'Pricing', href: '#pricing' },
  { name: 'FAQ', href: '#faq' },
];

export function LandingHeader() {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const brand = getClientBrandConfig();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${
        isScrolled ? 'bg-white/80 backdrop-blur-md border-b border-neutral-200' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex h-14 items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-neutral-950 hover:text-neutral-600 transition-colors"
          >
            {brand.appName}
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm text-neutral-500 hover:text-neutral-950 transition-colors"
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            {session ? (
              <Button asChild size="sm" variant="default" className="h-8 px-4 text-xs">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost" className="h-8 px-3 text-xs text-neutral-600">
                  <Link href="/auth/signin">Sign in</Link>
                </Button>
                <Button asChild size="sm" className="h-8 px-4 text-xs bg-neutral-950 hover:bg-neutral-800">
                  <Link href="/auth/signin?callbackUrl=/pricing">Get started</Link>
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            className="md:hidden p-2 -mr-2 text-neutral-600"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Menu"
          >
            {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden border-t border-neutral-200 pb-4 pt-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block py-2.5 text-sm text-neutral-600"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <div className="pt-3 mt-2 border-t border-neutral-200 space-y-2">
              {session ? (
                <Button asChild className="w-full h-9 text-xs" size="sm">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild className="w-full h-9 text-xs" size="sm">
                    <Link href="/auth/signin">Sign in</Link>
                  </Button>
                  <Button asChild className="w-full h-9 text-xs bg-neutral-950 hover:bg-neutral-800" size="sm">
                    <Link href="/auth/signin?callbackUrl=/pricing">Get started</Link>
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
