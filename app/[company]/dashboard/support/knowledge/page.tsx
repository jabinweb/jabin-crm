'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { FeatureModuleGuard } from '@/components/feature-module-guard';
import { SupportBackLink } from '@/components/support/support-back-link';
import { CardListSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

export default function KnowledgeBaseAdminPage() {
  const queryClient = useQueryClient();
  const { slug, workspaceFetch } = useWorkspacePaths();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Getting started');
  const [published, setPublished] = useState(true);

  const { data: articles, isLoading } = useQuery({
    queryKey: ['admin-knowledge', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/support/knowledge');
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch('/api/support/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, category, published }),
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Article published');
      setTitle('');
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['admin-knowledge'] });
    },
    onError: () => toast.error('Could not save article'),
  });

  return (
    <FeatureModuleGuard module="SUPPORT_KNOWLEDGE">
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <SupportBackLink />
        <div>
          <h1 className="text-2xl font-bold">Knowledge base</h1>
          <p className="text-sm text-muted-foreground">Customer-facing help articles (portal Help Center)</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>New article</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How to track your order" />
          </div>
          <div>
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div>
            <Label>Content</Label>
            <Textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Step-by-step instructions..." />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={published} onCheckedChange={setPublished} id="published" />
            <Label htmlFor="published">Published in portal</Label>
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={!title || !content || createMutation.isPending}>
            Save article
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Published articles</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <CardListSkeleton rows={4} /> : (
            <ul className="space-y-2">
              {(articles?.articles ?? []).map((a: any) => (
                <li key={a.id} className="flex justify-between border-b py-2 text-sm">
                  <span>{a.title}</span>
                  <span className="text-muted-foreground">{a.category}</span>
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
