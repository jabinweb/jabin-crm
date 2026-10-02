'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  BookOpen,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  documentationTopics,
  getTopicBySlug,
  getAllCategories,
  getTopicsByCategory,
  searchDocumentation,
  getTableOfContents,
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
} from '@/components/docs/doc-content';

export default function DocumentationPage() {
  const router = useRouter();
  const { path } = useWorkspacePaths();
  const searchParams = useSearchParams();
  const currentSlug = searchParams.get('topic') || 'introduction';
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentTopic = getTopicBySlug(currentSlug);
  const categories = getAllCategories();

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchDocumentation(searchQuery);
  }, [searchQuery]);

  // Table of contents for current topic
  const toc = currentTopic ? getTableOfContents(currentTopic) : [];

  const navigateToTopic = (slug: string) => {
    router.push(path(`/dashboard/docs?topic=${slug}`));
    setMobileMenuOpen(false);
    setSearchQuery('');
  };

  const renderContent = (content: any) => {
    switch (content.type) {
      case 'heading':
        return <DocHeading key={content.data.text} level={content.data.level}>{content.data.text}</DocHeading>;
      case 'paragraph':
        return <DocParagraph key={content.data}>{content.data}</DocParagraph>;
      case 'list':
        return <DocList key={JSON.stringify(content.data)} items={content.data.items} ordered={content.data.ordered} />;
      case 'code':
        return (
          <DocCodeBlock
            key={content.data.code}
            code={content.data.code}
            language={content.data.language}
            title={content.data.title}
          />
        );
      case 'alert':
        return (
          <DocAlert
            key={content.data.message}
            type={content.data.type}
            title={content.data.title}
            message={content.data.message}
          />
        );
      case 'table':
        return (
          <DocTable
            key={JSON.stringify(content.data)}
            headers={content.data.headers}
            rows={content.data.rows}
          />
        );
      case 'steps':
        return <DocSteps key={JSON.stringify(content.data)} steps={content.data} />;
      case 'grid':
        return <DocGrid key={JSON.stringify(content.data)} items={content.data} />;
      case 'divider':
        return <DocDivider key={Math.random()} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-w-0">
      {/* Mobile menu button */}
      <Button
        variant="outline"
        size="sm"
        className="mb-4 h-10 gap-2 lg:hidden"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        <BookOpen className="h-4 w-4" />
      </Button>

      <div className="flex min-w-0 gap-8">

      {/* Left Sidebar - Navigation */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r bg-background transition-transform lg:sticky lg:top-0 lg:z-auto lg:w-60 lg:max-w-none lg:shrink-0 lg:self-start lg:translate-x-0 lg:border lg:rounded-lg',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center border-b px-6 lg:h-12 lg:px-4">
          <BookOpen className="mr-2 h-5 w-5" />
          <span className="font-semibold">Documentation</span>
        </div>

        <ScrollArea className="h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-10rem)]">
          <div className="p-4 space-y-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Search Results */}
            {searchResults && searchResults.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase px-2">
                  Search Results ({searchResults.length})
                </div>
                {searchResults.map((topic) => (
                  <button
                    key={topic.slug}
                    onClick={() => navigateToTopic(topic.slug)}
                    className="w-full text-left px-3 py-2 text-sm rounded-none hover:bg-muted transition-colors"
                  >
                    <div className="font-medium">{topic.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{topic.category}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Navigation by Category */}
            {!searchResults && categories.map((category) => {
              const topics = getTopicsByCategory(category);
              return (
                <div key={category} className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase px-2 mb-2">
                    {category}
                  </div>
                  {topics.map((topic) => (
                    <button
                      key={topic.slug}
                      onClick={() => navigateToTopic(topic.slug)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm rounded-none transition-colors flex items-center justify-between',
                        currentSlug === topic.slug
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'hover:bg-muted'
                      )}
                    >
                      <span>{topic.title}</span>
                      {currentSlug === topic.slug && <ChevronRight className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1">
        <div className="max-w-4xl">
          {currentTopic ? (
            <>
              {/* Breadcrumbs */}
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-4 sm:mb-6">
                <span>{currentTopic.category}</span>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground font-medium">{currentTopic.title}</span>
              </div>

              {/* Title */}
              <h1 className="break-words text-3xl font-bold tracking-tight mb-4 sm:text-4xl">{currentTopic.title}</h1>
              {currentTopic.description && (
                <p className="text-lg text-muted-foreground mb-8 sm:text-xl">{currentTopic.description}</p>
              )}

              {/* Content */}
              <div className="prose prose-slate dark:prose-invert max-w-none">
                {currentTopic.sections.map((section) => (
                  <div key={section.id} id={section.id} className="scroll-mt-16">
                    <h2 className="text-2xl font-semibold tracking-tight mt-10 mb-6 border-b pb-2 sm:text-3xl">
                      {section.title}
                    </h2>
                    <div className="space-y-4">
                      {section.content.map((content, i) => (
                        <div key={i}>{renderContent(content)}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Navigation Footer */}
              <div className="mt-16 pt-8 border-t flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  Last updated: January 2026
                </div>
                <div className="flex gap-2">
                  {/* Previous/Next topic buttons can go here */}
                </div>
              </div>
            </>
          ) : (
            <div className="py-20 text-center">
              <h1 className="text-2xl font-semibold mb-2">Topic not found</h1>
              <p className="text-muted-foreground mb-6">The documentation topic you're looking for doesn't exist.</p>
              <Button onClick={() => navigateToTopic('introduction')}>
                Go to Introduction
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Right Sidebar - Table of Contents */}
      <aside className="hidden xl:block w-56 shrink-0 self-start sticky top-0">
        <div className="border-l pl-6">
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-4">
            On This Page
          </div>
          <div className="space-y-2">
            {toc.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                {item.title}
              </a>
            ))}
          </div>
        </div>
      </aside>
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}

