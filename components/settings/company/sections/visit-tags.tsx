'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { confirmAction } from '@/lib/confirm-action';
import { Skeleton } from '@/components/ui/skeleton';

type VisitTag = {
  id: string;
  name: string;
  color?: string | null;
  isSystem?: boolean;
};

export function VisitTagsSection() {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['visit-tags', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/visit-tags');
      if (!res.ok) throw new Error('Failed to load visit tags');
      return res.json() as Promise<{ tags: VisitTag[] }>;
    },
  });

  const tags = data?.tags || [];

  const addTag = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await workspaceFetch('/api/visit-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to create tag');
      toast.success('Visit tag created');
      setName('');
      queryClient.invalidateQueries({ queryKey: ['visit-tags', slug] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create tag');
    } finally {
      setBusy(false);
    }
  };

  const removeTag = async (tag: VisitTag) => {
    if (tag.isSystem) {
      toast.error('System tags cannot be deleted');
      return;
    }
    const ok = await confirmAction({
      title: `Delete tag “${tag.name}”?`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      const res = await workspaceFetch(`/api/visit-tags/${tag.id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to delete');
      toast.success('Tag deleted');
      queryClient.invalidateQueries({ queryKey: ['visit-tags', slug] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete tag');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visit tags</CardTitle>
        <CardDescription>
          Labels for technician visits across all clients (Demo, Follow-up, Night visit, etc.).
          System defaults are seeded automatically; add your own for local workflows.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="grid gap-2 flex-1 w-full">
            <Label htmlFor="visit-tag-name">New tag</Label>
            <Input
              id="visit-tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Training session"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="visit-tag-color">Color</Label>
            <Input
              id="visit-tag-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-16 p-1"
            />
          </div>
          <Button onClick={addTag} disabled={busy || !name.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="space-y-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: tag.color || '#64748b' }}
                  />
                  <span className="text-sm font-medium">{tag.name}</span>
                  {tag.isSystem ? <Badge variant="secondary">System</Badge> : null}
                </div>
                {!tag.isSystem ? (
                  <Button size="icon" variant="ghost" onClick={() => removeTag(tag)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
