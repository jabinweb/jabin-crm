'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2 } from 'lucide-react';

function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q')?.trim() ?? '';
  const [data, setData] = useState<{
    tickets: Array<{ id: string; subject: string; status: string }>;
    projects: Array<{ id: string; name: string; status: string }>;
    quotations: Array<{ id: string; title: string; quotationNumber: string; status: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.length < 2) {
      setData({ tickets: [], projects: [], quotations: [] });
      return;
    }
    setLoading(true);
    fetch(`/api/portal/search?q=${encodeURIComponent(q)}`)
      .then((res) => (res.ok ? res.json() : { tickets: [], projects: [], quotations: [] }))
      .then(setData)
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {q ? `Results for “${q}”` : 'Enter at least 2 characters in the header search.'}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Searching…</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tickets</h2>
            {data?.tickets?.length ? (
              data.tickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/portal/tickets/${t.id}`}
                  className="block rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                >
                  <p className="font-medium text-sm">{t.subject}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.status}</p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No tickets found.</p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Projects</h2>
            {data?.projects?.length ? (
              data.projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/portal/projects/${p.id}`}
                  className="block rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                >
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{p.status}</p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No projects found.</p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Quotations</h2>
            {data?.quotations?.length ? (
              data.quotations.map((q) => (
                <Link
                  key={q.id}
                  href={`/portal/quotations/${q.id}`}
                  className="block rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                >
                  <p className="font-medium text-sm">{q.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {q.quotationNumber} · {q.status}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No quotations found.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default function PortalSearchPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading search…</p>}>
      <SearchResults />
    </Suspense>
  );
}
