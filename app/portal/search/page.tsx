'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertTriangle, Search } from 'lucide-react';
import { humanizeStatus } from '@/lib/portal/status-label';

type SearchData = {
  tickets: Array<{ id: string; subject: string; status: string }>;
  projects: Array<{ id: string; name: string; status: string }>;
  quotations: Array<{ id: string; title: string; quotationNumber: string; status: string }>;
};

function SearchForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  return (
    <form
      role="search"
      className="flex w-full max-w-xl gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q.length < 2) return;
        router.push(`/portal/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search tickets, projects and quotations"
          placeholder="Search tickets, projects, quotations…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-10 pl-9"
          autoFocus={!initial}
        />
      </div>
      <Button type="submit" className="h-10 shrink-0" disabled={value.trim().length < 2}>
        Search
      </Button>
    </form>
  );
}

function ResultSection({
  title,
  empty,
  children,
  count,
}: {
  title: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        {count > 0 ? <span className="ml-1.5 font-normal normal-case">({count})</span> : null}
      </h2>
      {count > 0 ? children : <p className="text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q')?.trim() ?? '';
  const enabled = q.length >= 2;

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['portal-search', q],
    queryFn: async (): Promise<SearchData> => {
      const res = await fetch(`/api/portal/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled,
  });

  const total =
    (data?.tickets?.length ?? 0) + (data?.projects?.length ?? 0) + (data?.quotations?.length ?? 0);

  return (
    <div className="w-full space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Search</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {enabled
              ? `Results for “${q}”`
              : 'Find your tickets, projects and quotations. Enter at least 2 characters.'}
          </p>
        </div>
        <SearchForm key={q} initial={q} />
      </div>

      {!enabled ? null : isLoading ? (
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Search isn't working right now"
          description="Check your connection and try again."
          actionLabel={isRefetching ? 'Retrying…' : 'Try again'}
          onAction={() => void refetch()}
          className="rounded-lg border"
        />
      ) : total === 0 ? (
        <EmptyState
          icon={Search}
          title={`Nothing matches “${q}”`}
          description="Try a different word, a ticket subject, or a quotation number. Can't find it? Ask our team."
          actionLabel="Contact support"
          actionHref="/portal/tickets/new"
          className="rounded-lg border"
        />
      ) : (
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-3">
          <ResultSection title="Tickets" empty="No tickets found." count={data?.tickets?.length ?? 0}>
            {data?.tickets.map((t) => (
              <Link
                key={t.id}
                href={`/portal/tickets/${t.id}`}
                className="block rounded-lg border p-3 hover:bg-muted/40 transition-colors"
              >
                <p className="font-medium text-sm break-words">{t.subject}</p>
                <p className="text-xs text-muted-foreground mt-1">{humanizeStatus(t.status)}</p>
              </Link>
            ))}
          </ResultSection>

          <ResultSection title="Projects" empty="No projects found." count={data?.projects?.length ?? 0}>
            {data?.projects.map((p) => (
              <Link
                key={p.id}
                href={`/portal/projects/${p.id}`}
                className="block rounded-lg border p-3 hover:bg-muted/40 transition-colors"
              >
                <p className="font-medium text-sm break-words">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{humanizeStatus(p.status)}</p>
              </Link>
            ))}
          </ResultSection>

          <ResultSection
            title="Quotations"
            empty="No quotations found."
            count={data?.quotations?.length ?? 0}
          >
            {data?.quotations.map((item) => (
              <Link
                key={item.id}
                href={`/portal/quotations/${item.id}`}
                className="block rounded-lg border p-3 hover:bg-muted/40 transition-colors"
              >
                <p className="font-medium text-sm break-words">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.quotationNumber} · {humanizeStatus(item.status)}
                </p>
              </Link>
            ))}
          </ResultSection>
        </div>
      )}
    </div>
  );
}

export default function PortalSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full space-y-6">
          <h1 className="text-2xl font-bold tracking-tight">Search</h1>
          <Skeleton className="h-10 w-full max-w-xl" />
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
