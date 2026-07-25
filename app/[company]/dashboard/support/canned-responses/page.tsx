'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { FeatureModuleGuard } from '@/components/feature-module-guard';
import { SupportBackLink } from '@/components/support/support-back-link';
import { CardListSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { Pencil, Trash2 } from 'lucide-react';

type CannedResponse = {
  id: string;
  title: string;
  body: string;
  category?: string | null;
};

export default function CannedResponsesPage() {
  const queryClient = useQueryClient();
  const { slug, workspaceFetch } = useWorkspacePaths();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('General');
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: responses, isLoading } = useQuery({
    queryKey: ['canned-responses', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/support/canned-responses');
      if (!res.ok) throw new Error('Failed to load');
      return res.json() as Promise<CannedResponse[]>;
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setCategory('General');
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const res = await workspaceFetch(`/api/support/canned-responses/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, category }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to update');
        }
        return res.json();
      }
      const res = await workspaceFetch('/api/support/canned-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, category }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(editingId ? 'Template updated' : 'Canned response saved');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await workspaceFetch(`/api/support/canned-responses/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete');
      }
    },
    onSuccess: () => {
      toast.success('Template deleted');
      if (editingId) resetForm();
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (r: CannedResponse) => {
    setEditingId(r.id);
    setTitle(r.title);
    setBody(r.body);
    setCategory(r.category || 'General');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <FeatureModuleGuard module="SUPPORT_CANNED">
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <SupportBackLink />
          <div>
            <h1 className="text-2xl font-bold">Canned responses</h1>
            <p className="text-sm text-muted-foreground">
              Quick replies for support agents on tickets
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit template' : 'Add template'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Acknowledge receipt"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!title || !body || saveMutation.isPending}
              >
                {editingId ? 'Update' : 'Save'}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Library</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <CardListSkeleton rows={3} />
            ) : (
              responses?.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-3 border rounded-lg p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{r.title}</p>
                    {r.category ? (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{r.category}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.body}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => startEdit(r)}
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        if (window.confirm(`Delete “${r.title}”?`)) {
                          deleteMutation.mutate(r.id);
                        }
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            {!isLoading && !responses?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No templates yet
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </FeatureModuleGuard>
  );
}
