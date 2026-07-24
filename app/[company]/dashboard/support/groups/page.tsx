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

export default function SupportGroupsPage() {
  const queryClient = useQueryClient();
  const { slug, workspaceFetch } = useWorkspacePaths();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');

  const { data: groups, isLoading } = useQuery({
    queryKey: ['support-groups', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/support/groups');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch('/api/support/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, description }),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Group created');
      setName('');
      setEmail('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['support-groups'] });
    },
  });

  return (
    <FeatureModuleGuard module="SUPPORT_GROUPS">
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <SupportBackLink />
        <div>
          <h1 className="text-2xl font-bold">Agent groups</h1>
          <p className="text-sm text-muted-foreground">Queues for billing, technical, and regional teams</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Create group</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Technical support" />
          </div>
          <div>
            <Label>Support email (optional)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="support@company.com" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={!name}>Create</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Groups</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <CardListSkeleton rows={3} /> : (
            groups?.map((g: any) => (
              <div key={g.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="font-medium">{g.name}</p>
                  {g.email && <p className="text-xs text-muted-foreground">{g.email}</p>}
                </div>
                <Badge variant="secondary">{g._count?.tickets ?? 0} tickets</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
    </FeatureModuleGuard>
  );
}
