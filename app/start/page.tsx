'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BUSINESS_VERTICAL_OPTIONS } from '@/lib/workspace-templates';
import { getClientBrandConfig } from '@/lib/branding';
import { cn } from '@/lib/utils';
import {
  getEnvTenancyMode,
  type TenancyMode,
} from '@/lib/tenancy/mode';
import { ArrowRight, Check, Loader2, Ticket, Clock, FileText } from 'lucide-react';
import { toast } from 'sonner';

const TEAM_SIZES = [
  { id: '1-10', label: '1 – 10' },
  { id: '11-35', label: '11 – 35' },
  { id: '36-100', label: '36 – 100' },
  { id: '100+', label: '100+' },
] as const;

const COUNTRIES = [
  { code: 'IN', label: 'India' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AE', label: 'UAE' },
  { code: 'SA', label: 'Saudi Arabia' },
  { code: 'SG', label: 'Singapore' },
  { code: 'DE', label: 'Germany' },
  { code: 'AU', label: 'Australia' },
  { code: 'PL', label: 'Poland' },
  { code: 'OTHER', label: 'Other' },
] as const;

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export default function StartPage() {
  const brand = getClientBrandConfig();
  const router = useRouter();
  const { status } = useSession();
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle');
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const [workspace, setWorkspace] = useState({
    companyName: '',
    slug: '',
    businessVertical: 'field_service',
    country: 'IN',
    teamSize: '1-10' as string,
  });

  const [account, setAccount] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [tenancyMode, setTenancyMode] = useState<TenancyMode>(() => getEnvTenancyMode());
  const [hostHint, setHostHint] = useState(() => {
    try {
      if (brand.appUrl) return new URL(brand.appUrl).host;
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined') return window.location.host;
    return 'localhost:3000';
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/platform/config');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.tenancyMode === 'path' || data.tenancyMode === 'subdomain') {
          setTenancyMode(data.tenancyMode);
        }
        if (typeof data.host === 'string' && data.host) {
          setHostHint(data.host);
        }
      } catch {
        /* keep env defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/workspace');
    }
  }, [status, router]);

  useEffect(() => {
    if (!workspace.slug || workspace.slug.length < 2) {
      setSlugStatus('idle');
      setSlugError(null);
      return;
    }
    setSlugStatus('checking');
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/start?slug=${encodeURIComponent(workspace.slug)}`
        );
        const data = await res.json();
        if (data.available) {
          setSlugStatus('ok');
          setSlugError(null);
          if (data.slug && data.slug !== workspace.slug) {
            setWorkspace((w) => ({ ...w, slug: data.slug }));
          }
        } else {
          setSlugStatus('bad');
          setSlugError(data.error || 'Unavailable');
        }
      } catch {
        setSlugStatus('idle');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [workspace.slug]);

  const canContinueWorkspace =
    workspace.companyName.trim().length >= 2 &&
    workspace.slug.length >= 2 &&
    slugStatus === 'ok' &&
    !!workspace.businessVertical;

  const finish = async () => {
    if (!account.name.trim() || !account.email.trim() || account.password.length < 8) {
      toast.error('Fill in your name, email, and a strong password');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...workspace,
          country: workspace.country === 'OTHER' ? undefined : workspace.country,
          ...account,
          email: account.email.trim().toLowerCase(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not create workspace');

      if (data.country && data.country.length === 2) {
        await fetch('/api/pricing/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ countryCode: data.country }),
        }).catch(() => null);
      }

      const signed = await signIn('credentials', {
        email: account.email.trim().toLowerCase(),
        password: account.password,
        redirect: false,
      });

      if (signed?.error) {
        toast.success('Workspace created — please sign in');
        router.push(
          `/auth/signin?callbackUrl=${encodeURIComponent(`/${data.companySlug}/dashboard`)}`
        );
        return;
      }

      toast.success('Welcome to your workspace');
      router.push(`/${data.companySlug}/dashboard`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand rail — fixed; never scrolls on desktop */}
      <aside className="relative hidden lg:flex h-full min-h-0 flex-col justify-between p-10 text-white bg-slate-950 overflow-hidden">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(13,148,136,0.35), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 80%, rgba(15,23,42,0.5), transparent)',
          }}
        />
        <div className="relative">
          <p className="text-xl font-semibold tracking-tight">{brand.appName}</p>
          <p className="mt-1 text-sm text-slate-400">Service ops, simplified</p>
        </div>
        <div className="relative space-y-8 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            One workspace for tickets, field work, and renewals.
          </h1>
          <ul className="space-y-4 text-sm text-slate-300">
            {[
              { icon: Ticket, text: 'Log jobs and track them to close' },
              { icon: Clock, text: 'See SLA risk before it breaches' },
              { icon: FileText, text: 'Never miss an AMC renewal' },
            ].map((item) => (
              <li key={item.text} className="flex gap-3 items-start">
                <item.icon className="h-4 w-4 mt-0.5 text-teal-400 shrink-0" />
                {item.text}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            Live in about 90 seconds · No credit card · Free to start
          </p>
        </div>
        <p className="relative text-xs text-slate-600">© {new Date().getFullYear()} {brand.appName}</p>
      </aside>

      {/* Form — only this column scrolls */}
      <main className="h-full min-h-0 overflow-y-auto overscroll-contain px-6 py-12 sm:px-10 lg:px-16 bg-stone-50">
        <div className="mx-auto w-full max-w-lg lg:min-h-full lg:flex lg:flex-col lg:justify-center">
          <div className="lg:hidden mb-8">
            <p className="text-lg font-semibold">{brand.appName}</p>
            <p className="text-sm text-muted-foreground">Get started free</p>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-8">
            <span className={cn(step === 1 && 'text-foreground')}>1 · Workspace</span>
            <span className="text-border">→</span>
            <span className={cn(step === 2 && 'text-foreground')}>2 · Account</span>
          </div>

          {step === 1 ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Set up your workspace
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Tell us about your company — we&apos;ll configure the basics for your industry.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">Company name *</Label>
                <Input
                  id="companyName"
                  value={workspace.companyName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setWorkspace((w) => ({
                      ...w,
                      companyName: value,
                      slug: slugTouched ? w.slug : slugify(value),
                    }));
                  }}
                  placeholder="Acme Service Co"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Workspace URL *</Label>
                <div className="flex rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                  {tenancyMode === 'path' && (
                    <span className="flex items-center pl-3 pr-1 text-xs text-muted-foreground bg-muted/50 border-r shrink-0">
                      {hostHint}/
                    </span>
                  )}
                  <Input
                    id="slug"
                    className="border-0 shadow-none focus-visible:ring-0 rounded-none"
                    value={workspace.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setWorkspace((w) => ({
                        ...w,
                        slug: slugify(e.target.value),
                      }));
                    }}
                    placeholder="acme"
                  />
                  {tenancyMode === 'subdomain' && (
                    <span className="flex items-center px-3 text-xs text-muted-foreground bg-muted/50 border-l shrink-0">
                      .{hostHint}
                    </span>
                  )}
                </div>
                {slugStatus === 'checking' && (
                  <p className="text-xs text-muted-foreground">Checking…</p>
                )}
                {slugStatus === 'ok' && (
                  <p className="text-xs text-emerald-700 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Available
                  </p>
                )}
                {slugStatus === 'bad' && (
                  <p className="text-xs text-destructive">{slugError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Industry *</Label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {BUSINESS_VERTICAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setWorkspace((w) => ({ ...w, businessVertical: opt.id }))
                      }
                      className={cn(
                        'text-left rounded-xl border px-3 py-3 transition-colors',
                        workspace.businessVertical === opt.id
                          ? 'border-teal-600 bg-teal-50/80 ring-1 ring-teal-600/30'
                          : 'border-border bg-white hover:bg-muted/40'
                      )}
                    >
                      <p className="text-sm font-medium text-foreground">{opt.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                        {opt.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select
                    value={workspace.country}
                    onValueChange={(v) => setWorkspace((w) => ({ ...w, country: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Team size</Label>
                  <Select
                    value={workspace.teamSize}
                    onValueChange={(v) => setWorkspace((w) => ({ ...w, teamSize: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_SIZES.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                className="w-full h-11 bg-teal-700 hover:bg-teal-800"
                disabled={!canContinueWorkspace}
                onClick={() => setStep(2)}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Create your admin account
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  You&apos;ll be the workspace admin for{' '}
                  <span className="font-medium text-foreground">{workspace.companyName}</span>.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Your name *</Label>
                <Input
                  id="name"
                  value={account.name}
                  onChange={(e) => setAccount((a) => ({ ...a, name: e.target.value }))}
                  placeholder="Priya Sharma"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={account.email}
                  onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))}
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={account.password}
                  onChange={(e) => setAccount((a) => ({ ...a, password: e.target.value }))}
                  placeholder="8+ chars, upper, lower, number"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={busy}
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 h-11 bg-teal-700 hover:bg-teal-800"
                  disabled={busy}
                  onClick={finish}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Launch workspace
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link href="/auth/signin" className="underline underline-offset-2 text-foreground">
              Sign in
            </Link>
            {' · '}
            <Link href="/pricing" className="underline underline-offset-2 text-foreground">
              Pricing
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
