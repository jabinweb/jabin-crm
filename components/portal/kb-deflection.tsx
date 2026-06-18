'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BookOpen, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface KbDeflectionProps {
  ticketTypeId?: string;
  searchQuery?: string;
  onResolved?: () => void;
}

export function KbDeflection({ ticketTypeId, searchQuery, onResolved }: KbDeflectionProps) {
  const queryKey = ['kb-deflection', ticketTypeId, searchQuery];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (ticketTypeId) params.set('ticketType', ticketTypeId);
      if (searchQuery?.trim()) params.set('q', searchQuery.trim());
      const res = await fetch(`/api/support/knowledge?${params}`);
      if (!res.ok) return { articles: [] };
      return res.json();
    },
    enabled: !!ticketTypeId || !!searchQuery?.trim(),
    staleTime: 30_000,
  });

  const articles = data?.articles ?? [];
  if (!ticketTypeId && !searchQuery?.trim()) return null;
  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching help articles…
        </CardContent>
      </Card>
    );
  }
  if (articles.length === 0) return null;

  return (
    <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4 text-emerald-700" />
          Before you submit — did this help?
        </CardTitle>
        <CardDescription>
          These articles may answer your question without opening a request.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {articles.slice(0, 5).map((article: { id: string; slug: string; title: string; category?: string }) => (
          <Link
            key={article.id}
            href={`/portal/support?slug=${article.slug}`}
            target="_blank"
            className="block rounded-md border bg-white/80 p-3 text-sm transition-colors hover:bg-white dark:bg-slate-900/50"
          >
            <p className="font-medium">{article.title}</p>
            {article.category ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{article.category}</p>
            ) : null}
          </Link>
        ))}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onResolved}>
            <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
            Yes, this solved my issue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
