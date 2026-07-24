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
import {
  LifeBuoy,
  Search,
  BookOpen,
  MessageSquarePlus,
  ThumbsUp,
  ArrowLeft,
  Mail,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { useWorkspaceConfig } from '@/hooks/use-workspace-config';
import { DetailSkeleton, PageHeaderSkeleton, CardListSkeleton, SectionSkeleton } from '@/components/loading';

function PortalSupportContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug');
  const { data: workspaceData } = useWorkspaceConfig();
  const supportChannels = workspaceData?.support?.channels;
  const terminology = workspaceData?.config.terminology;
  const ticketLabel = terminology?.ticket ?? 'Ticket';

  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

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
    queryKey: ['portal-knowledge', search, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (categoryFilter) params.set('category', categoryFilter);
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
        <div className="space-y-6">
          <PageHeaderSkeleton />
          <DetailSkeleton />
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
                If you still need assistance, open a support {ticketLabel.toLowerCase()}.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  await fetch(`/api/support/knowledge/${article.id}/helpful`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ helpful: true }),
                  });
                }}
              >
                <ThumbsUp className="mr-2 h-4 w-4" />
                Yes
              </Button>
              <Button asChild>
                <Link href="/portal/tickets/new">Contact support</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Help &amp; support</h1>
          <p className="text-muted-foreground mt-1">
            {terminology?.portalSubtitle ??
              'Search solutions, browse guides, or contact us through your preferred channel.'}
          </p>
        </div>
        <Button asChild>
          <Link href="/portal/tickets/new">
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            {terminology?.newRequest ?? `New ${ticketLabel}`}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Knowledge base
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Self-service articles below</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquarePlus className="h-4 w-4" /> {ticketLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="link" className="h-auto p-0 text-xs">
              <Link href="/portal/tickets/new">Open a {ticketLabel.toLowerCase()}</Link>
            </Button>
          </CardContent>
        </Card>
        {supportChannels?.email ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="h-4 w-4" /> Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <a href={`mailto:${supportChannels.email}`} className="text-xs text-primary hover:underline">
                {supportChannels.email}
              </a>
            </CardContent>
          </Card>
        ) : null}
        {supportChannels?.phone ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Phone className="h-4 w-4" /> Phone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <a href={`tel:${supportChannels.phone}`} className="text-xs text-primary hover:underline">
                {supportChannels.phone}
              </a>
            </CardContent>
          </Card>
        ) : null}
        {supportChannels?.chat ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageCircle className="h-4 w-4" /> Live chat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Use the chat widget in the corner</p>
            </CardContent>
          </Card>
        ) : null}
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
        <div className="space-y-4">
          <SectionSkeleton lines={2} />
          <CardListSkeleton rows={4} />
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
                  onClick={() => {
                    setCategoryFilter(cat.category ?? '');
                    setSearch('');
                    setQuery('');
                  }}
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
              Our {terminology?.agent?.toLowerCase() ?? 'support'} team handles requests from every channel.
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
        <div className="space-y-6">
          <PageHeaderSkeleton />
          <CardListSkeleton rows={4} />
        </div>
      }
    >
      <PortalSupportContent />
    </Suspense>
  );
}
