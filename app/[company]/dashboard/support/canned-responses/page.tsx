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
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

export default function CannedResponsesPage() {
  const queryClient = useQueryClient();
  const { slug, workspaceFetch } = useWorkspacePaths();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('General');

  const { data: responses, isLoading } = useQuery({
    queryKey: ['canned-responses', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/support/canned-responses');
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch('/api/support/canned-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, category }),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Canned response saved');
      setTitle('');
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
    },
  });

  return (
    <FeatureModuleGuard module="SUPPORT_CANNED">
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <SupportBackLink />
        <div>
          <h1 className="text-2xl font-bold">Canned responses</h1>
          <p className="text-sm text-muted-foreground">Quick replies for support agents on tickets</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Add template</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Acknowledge receipt" />
          </div>
          <div>
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={!title || !body}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Library</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
            responses?.map((r: any) => (
              <div key={r.id} className="border rounded-lg p-3">
                <p className="font-medium text-sm">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.body}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
    </FeatureModuleGuard>
  );
}
