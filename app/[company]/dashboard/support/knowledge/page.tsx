'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FeatureModuleGuard } from '@/components/feature-module-guard';
import { SupportBackLink } from '@/components/support/support-back-link';
import { CardListSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { confirmAction } from '@/lib/confirm-action';

type Article = {
  id: string;
  title: string;
  content?: string;
  category?: string | null;
  published?: boolean;
  slug?: string;
};

export default function KnowledgeBaseAdminPage() {
  const queryClient = useQueryClient();
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Getting started');
  const [published, setPublished] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: articles, isLoading } = useQuery({
    queryKey: ['admin-knowledge', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/support/knowledge?admin=1');
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const resetForm = () => {
    setTitle('');
    setContent('');
    setCategory('Getting started');
    setPublished(true);
    setEditingId(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const res = await workspaceFetch('/api/support/knowledge', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            title,
            content,
            category,
            published,
          }),
        });
        if (!res.ok) throw new Error('Failed to update');
        return res.json();
      }
      const res = await workspaceFetch('/api/support/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, category, published }),
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => {
      toast.success(editingId ? 'Article updated' : 'Article saved');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['admin-knowledge'] });
    },
    onError: () => toast.error('Could not save article'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await workspaceFetch('/api/support/knowledge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      toast.success('Article deleted');
      if (editingId) resetForm();
      queryClient.invalidateQueries({ queryKey: ['admin-knowledge'] });
    },
    onError: () => toast.error('Could not delete article'),
  });

  const startEdit = (a: Article) => {
    setEditingId(a.id);
    setTitle(a.title);
    setContent(a.content || '');
    setCategory(a.category || 'Getting started');
    setPublished(a.published ?? true);
  };

  return (
    <FeatureModuleGuard module="SUPPORT_KNOWLEDGE">
      <div className="space-y-6 max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <SupportBackLink />
            <div>
              <h1 className="text-2xl font-bold">Knowledge base</h1>
              <p className="text-sm text-muted-foreground">
                Customer-facing help articles (portal Help Center)
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href={path('/dashboard/settings/migration') + '?object=knowledge'}>
              Import CSV
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit article' : 'New article'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="How to track your order"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div>
              <Label>Content</Label>
              <Textarea
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Step-by-step instructions..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={published} onCheckedChange={setPublished} id="published" />
              <Label htmlFor="published">Published in portal</Label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!title || !content || saveMutation.isPending}
              >
                {editingId ? 'Save changes' : 'Save article'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Articles</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <CardListSkeleton rows={4} />
            ) : (
              <ul className="space-y-2">
                {(articles?.articles ?? []).map((a: Article) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-medium">{a.title}</span>
                      <span className="text-muted-foreground ml-2">{a.category}</span>
                      {!a.published && (
                        <Badge variant="outline" className="ml-2">
                          Draft
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(a)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (
                            !(await confirmAction({
                              title: 'Delete this article?',
                              description: 'This cannot be undone.',
                              confirmLabel: 'Delete',
                              variant: 'destructive',
                            }))
                          )
                            return;
                          deleteMutation.mutate(a.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </FeatureModuleGuard>
  );
}
