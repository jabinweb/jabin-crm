'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getTopicBySlug,
  getAllCategories,
  getTopicsByCategory,
  searchDocumentation,
  type DocContent,
  type DocTopic,
} from '@/lib/docs/comprehensive-docs';
import {
  DocParagraph,
  DocHeading,
  DocList,
  DocCodeBlock,
  DocAlert,
  DocTable,
  DocSteps,
  DocGrid,
  DocDivider,
  docAnchorId,
} from '@/components/docs/doc-content';

type TocItem = { id: string; title: string; depth: 2 | 3 };

/** Sections plus the level-3 headings inside them, in reading order. */
function tableOfContents(topic: DocTopic): TocItem[] {
  return topic.sections.flatMap((section) => [
    { id: section.id, title: section.title, depth: 2 as const },
    ...section.content
      .filter((c) => c.type === 'heading' && c.data?.level === 3 && typeof c.data.text === 'string')
      .map((c) => ({ id: docAnchorId(c.data.text), title: c.data.text as string, depth: 3 as const })),
  ]);
}

function renderContent(content: DocContent) {
  switch (content.type) {
    case 'heading':
      return <DocHeading level={content.data.level}>{content.data.text}</DocHeading>;
    case 'paragraph':
      return <DocParagraph>{content.data}</DocParagraph>;
    case 'list':
      return <DocList items={content.data.items} ordered={content.data.ordered} />;
    case 'code':
      return <DocCodeBlock code={content.data.code} language={content.data.language} title={content.data.title} />;
    case 'alert':
      return <DocAlert type={content.data.type} title={content.data.title} message={content.data.message} />;
    case 'table':
      return <DocTable headers={content.data.headers} rows={content.data.rows} />;
    case 'steps':
      return <DocSteps steps={content.data} />;
    case 'grid':
      return <DocGrid items={content.data} />;
    case 'divider':
      return <DocDivider />;
    default:
      return null;
  }
}

/** Topic list grouped by category (search filters it in place). */
function DocsNav({
  currentSlug,
  query,
  onQuery,
  onOpen,
  searchRef,
}: {
  currentSlug: string;
  query: string;
  onQuery: (q: string) => void;
  onOpen: (slug: string) => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const results = query.trim() ? searchDocumentation(query.trim()) : null;
  const groups = results
    ? getAllCategories()
        .map((category) => ({ category, topics: results.filter((t) => t.category === category) }))
        .filter((g) => g.topics.length > 0)
    : getAllCategories().map((category) => ({ category, topics: getTopicsByCategory(category) }));

  return (
    <nav aria-label="Documentation" className="flex flex-col gap-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results?.[0]) onOpen(results[0].slug);
            if (e.key === 'Escape') onQuery('');
          }}
          placeholder="Search docs"
          aria-label="Search documentation"
          className="h-9 pl-8 pr-8"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground sm:block">
          /
        </kbd>
      </div>

      {results && groups.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">No results for “{query.trim()}”.</p>
      ) : null}

      {groups.map(({ category, topics }) => (
        <div key={category}>
          <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {category}
          </p>
          <ul className="border-l">
            {topics.map((topic) => {
              const active = topic.slug === currentSlug;
              return (
                <li key={topic.slug}>
                  <button
                    type="button"
                    onClick={() => onOpen(topic.slug)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      '-ml-px block w-full border-l-2 py-1.5 pl-3 pr-2 text-left text-sm transition-colors',
                      active
                        ? 'border-foreground font-medium text-foreground'
                        : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                    )}
                  >
                    {topic.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function DocumentationPage() {
  const router = useRouter();
  const { path } = useWorkspacePaths();
  const searchParams = useSearchParams();
  const currentSlug = searchParams.get('topic') || 'introduction';
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const articleRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const topic = getTopicBySlug(currentSlug);
  const toc = useMemo(() => (topic ? tableOfContents(topic) : []), [topic]);

  // Reading order across categories → previous / next topic
  const ordered = useMemo(
    () => getAllCategories().flatMap((category) => getTopicsByCategory(category)),
    []
  );
  const index = ordered.findIndex((t) => t.slug === currentSlug);
  const prev = index > 0 ? ordered[index - 1] : null;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;

  const openTopic = (slug: string) => {
    router.push(path(`/dashboard/docs?topic=${slug}`), { scroll: false });
    setMenuOpen(false);
    setQuery('');
  };

  // New topic starts at the top (the dashboard scrolls its own <main>)
  useEffect(() => {
    articleRef.current?.closest('main')?.scrollTo({ top: 0 });
    setActiveId(null);
  }, [currentSlug]);

  // "/" jumps to search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== '/' || target?.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
      if (window.matchMedia('(min-width: 1024px)').matches) searchRef.current?.focus();
      else setMenuOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Highlight the heading being read in "On this page"
  useEffect(() => {
    if (toc.length < 2) return;
    const elements = toc
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -65% 0px' }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [toc]);

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  };

  const nav = (
    <DocsNav currentSlug={currentSlug} query={query} onQuery={setQuery} onOpen={openTopic} searchRef={searchRef} />
  );

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_200px] xl:gap-10">
      {/* Topic menu: sticky column on desktop, slide-out panel below */}
      <aside className="hidden lg:block">
        <div className="sticky top-0 max-h-[calc(100dvh-7rem)] overflow-y-auto pb-6 pr-2">{nav}</div>
      </aside>

      <article ref={articleRef} className="min-w-0">
        <Button
          variant="outline"
          className="mb-5 h-10 w-full justify-between lg:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Open documentation menu"
        >
          <span className="flex min-w-0 items-center gap-2">
            <BookOpen className="h-4 w-4 shrink-0" />
            <span className="truncate">{topic ? `${topic.category} · ${topic.title}` : 'Documentation'}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>

        {topic ? (
          <div className="max-w-3xl">
            <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              <span>Docs</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>{topic.category}</span>
            </nav>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{topic.title}</h1>
            {topic.description ? (
              <p className="mt-3 text-lg leading-8 text-muted-foreground">{topic.description}</p>
            ) : null}

            <div className="mt-8 border-t">
              {topic.sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="mb-3 mt-10 text-xl font-semibold tracking-tight">{section.title}</h2>
                  <div className="space-y-4">
                    {section.content.map((content, i) => (
                      <div key={i}>{renderContent(content)}</div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {prev || next ? (
              <div className="mt-14 grid gap-3 border-t pt-8 sm:grid-cols-2">
                {prev ? (
                  <button
                    type="button"
                    onClick={() => openTopic(prev.slug)}
                    className="group rounded-lg border p-4 text-left transition-colors hover:border-foreground/30"
                  >
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                      Previous
                    </span>
                    <span className="mt-1 block font-medium">{prev.title}</span>
                  </button>
                ) : (
                  <span className="hidden sm:block" />
                )}
                {next ? (
                  <button
                    type="button"
                    onClick={() => openTopic(next.slug)}
                    className="group rounded-lg border p-4 text-right transition-colors hover:border-foreground/30"
                  >
                    <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                      Next
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span className="mt-1 block font-medium">{next.title}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="max-w-3xl py-20 text-center">
            <h1 className="mb-2 text-2xl font-semibold">Topic not found</h1>
            <p className="mb-6 text-muted-foreground">That documentation page doesn’t exist.</p>
            <Button onClick={() => openTopic('introduction')}>Go to Introduction</Button>
          </div>
        )}
      </article>

      {/* On this page */}
      <aside className="hidden xl:block">
        {toc.length >= 2 ? (
          <div className="sticky top-0 max-h-[calc(100dvh-7rem)] overflow-y-auto">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">On this page</p>
            <ul className="space-y-1 border-l">
              {toc.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => jumpTo(item.id)}
                    className={cn(
                      '-ml-px block w-full border-l-2 py-1 text-left text-[13px] leading-5 transition-colors',
                      item.depth === 3 ? 'pl-6' : 'pl-3',
                      activeId === item.id
                        ? 'border-foreground font-medium text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {item.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[min(100vw,20rem)] overflow-y-auto p-5" srOnlyTitle="Documentation menu">
          <div className="mt-6">{nav}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
