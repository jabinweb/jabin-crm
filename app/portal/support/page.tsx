'use client';

import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LifeBuoy, Search, BookOpen, MessageSquarePlus, ThumbsUp, ArrowLeft } from 'lucide-react';

function PortalSupportContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug');

  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');

  const { data: article, isLoading: articleLoading } = useQuery({
    queryKey: ['portal-knowledge-article', slug],
    queryFn: async () => {
      const res = await fetch(`/api/support/knowledge?slug=${encodeURIComponent(slug!)}`);
      if (!res.ok) throw new Error('Article not found');
      return res.json();
    },
    enabled: !!slug,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['portal-knowledge', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      const res = await fetch(`/api/support/knowledge?${params}`);
      if (!res.ok) throw new Error('Failed to load help articles');
      return res.json();
    },
    enabled: !slug,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(query.trim());
  };

  if (slug) {
    if (articleLoading) {
      return (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-10 w-10 border-b-2 border-primary rounded-full" />
        </div>
      );
    }

    if (!article) {
      return (
        <div className="space-y-4 text-center py-16">
          <LifeBuoy className="h-12 w-12 mx-auto text-muted-foreground opacity-40" />
          <p className="text-muted-foreground">Article not found.</p>
          <Button asChild variant="outline">
            <Link href="/portal/support">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Help Center
            </Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-3xl">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/portal/support">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Help Center
          </Link>
        </Button>

        <div>
          {article.category && (
            <Badge variant="secondary" className="mb-2">
              {article.category}
            </Badge>
          )}
          <h1 className="text-3xl font-bold tracking-tight">{article.title}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Updated {new Date(article.updatedAt).toLocaleDateString()}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {article.content}
          </CardContent>
        </Card>

        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-100">
          <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Was this helpful?</p>
              <p className="text-sm text-muted-foreground">
                If you still need assistance, open a support ticket.
              </p>
            </div>
            <Button asChild>
              <Link href="/portal/tickets/new">Contact support</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Help Center</h1>
          <p className="text-muted-foreground mt-1">
            Search solutions, browse guides, or open a support ticket for any product or service.
          </p>
        </div>
        <Button asChild>
          <Link href="/portal/tickets/new">
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Contact support
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5" />
            Search the knowledge base
          </CardTitle>
          <CardDescription>
            Answers for billing, onboarding, technical issues, and account management.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
            <Input
              placeholder="How do I reset my password?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-10 w-10 border-b-2 border-primary rounded-full" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Articles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.articles?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <LifeBuoy className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No articles yet. Your support team can publish guides here.</p>
                  <Button asChild variant="link" className="mt-2">
                    <Link href="/portal/tickets/new">Submit a question instead</Link>
                  </Button>
                </div>
              ) : (
                data?.articles?.map((item: { id: string; slug: string; title: string; category?: string; updatedAt: string }) => (
                  <Link
                    key={item.id}
                    href={`/portal/support?slug=${item.slug}`}
                    className="block p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        {item.category && (
                          <Badge variant="secondary" className="mt-1 text-[10px]">
                            {item.category}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Popular topics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.categories ?? []).map((cat: { category: string | null; _count: number }) => (
                <Button
                  key={cat.category}
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => setSearch(cat.category ?? '')}
                >
                  <span>{cat.category || 'General'}</span>
                  <Badge variant="outline">{cat._count}</Badge>
                </Button>
              ))}
              {!data?.categories?.length && (
                <p className="text-sm text-muted-foreground">
                  Categories appear as your team publishes help content.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-100">
        <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold flex items-center gap-2">
              <ThumbsUp className="h-4 w-4" />
              Still need help?
            </p>
            <p className="text-sm text-muted-foreground">
              Our support agents handle requests from every industry — not just healthcare.
            </p>
          </div>
          <Button asChild variant="default">
            <Link href="/portal/tickets/new">Open a ticket</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PortalSupportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <div className="animate-spin h-10 w-10 border-b-2 border-primary rounded-full" />
        </div>
      }
    >
      <PortalSupportContent />
    </Suspense>
  );
}
