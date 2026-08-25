'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FeatureModuleGuard } from '@/components/feature-module-guard';
import { SupportBackLink } from '@/components/support/support-back-link';
import { CardListSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { confirmAction } from '@/lib/confirm-action';

type SupportGroup = {
  id: string;
  name: string;
  email?: string | null;
  description?: string | null;
  _count?: { tickets?: number };
};

export default function SupportGroupsPage() {
  const queryClient = useQueryClient();
  const { slug, workspaceFetch } = useWorkspacePaths();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: groups, isLoading } = useQuery({
    queryKey: ['support-groups', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/support/groups');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const resetForm = () => {
    setName('');
    setEmail('');
    setDescription('');
    setEditingId(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const res = await workspaceFetch(`/api/support/groups/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, description }),
        });
        if (!res.ok) throw new Error('Failed to update');
        return res.json();
      }
      const res = await workspaceFetch('/api/support/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, description }),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      toast.success(editingId ? 'Group updated' : 'Group created');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['support-groups'] });
    },
    onError: () => toast.error('Could not save group'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await workspaceFetch(`/api/support/groups/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      toast.success('Group deleted');
      if (editingId) resetForm();
      queryClient.invalidateQueries({ queryKey: ['support-groups'] });
    },
    onError: () => toast.error('Could not delete group'),
  });

  const startEdit = (g: SupportGroup) => {
    setEditingId(g.id);
    setName(g.name);
    setEmail(g.email || '');
    setDescription(g.description || '');
  };

  return (
    <FeatureModuleGuard module="SUPPORT_GROUPS">
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <SupportBackLink />
          <div>
            <h1 className="text-2xl font-bold">Agent groups</h1>
            <p className="text-sm text-muted-foreground">
              Queues for billing, technical, and regional teams
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit group' : 'Create group'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Technical support"
              />
            </div>
            <div>
              <Label>Support email (optional)</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="support@company.com"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={!name}>
                {editingId ? 'Save changes' : 'Create'}
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
            <CardTitle>Groups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <CardListSkeleton rows={3} />
            ) : (
              (groups as SupportGroup[] | undefined)?.map((g) => (
                <div
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3"
                >
                  <div>
                    <p className="font-medium">{g.name}</p>
                    {g.email && (
                      <p className="text-xs text-muted-foreground">{g.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{g._count?.tickets ?? 0} tickets</Badge>
                    <Button variant="ghost" size="sm" onClick={() => startEdit(g)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (
                          !(await confirmAction({
                            title: 'Delete this group?',
                            description: 'This cannot be undone.',
                            confirmLabel: 'Delete',
                            variant: 'destructive',
                          }))
                        )
                          return;
                        deleteMutation.mutate(g.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </FeatureModuleGuard>
  );
}
