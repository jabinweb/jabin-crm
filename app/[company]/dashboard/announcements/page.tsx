'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { Loader2, Megaphone } from 'lucide-react';
import { toast } from 'sonner';

type Announcement = {
  id: string;
  title: string;
  content: string;
  priority: number;
  createdAt: string;
};

export default function AnnouncementsAdminPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const res = await fetch('/api/employee/announcements');
      if (!res.ok) throw new Error('Failed to load');
      return (await res.json()) as Announcement[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/employee/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, priority: 0 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Announcement published');
      setTitle('');
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
        <p className="text-sm text-muted-foreground">
          Post company-wide updates visible in the employee portal.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New announcement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ann-title">Title</Label>
            <Input
              id="ann-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Holiday schedule"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ann-body">Message</Label>
            <Textarea
              id="ann-body"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Share details with the team…"
            />
          </div>
          <Button
            disabled={!title.trim() || !content.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publish
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : announcements.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No announcements yet"
              description="Publish your first company update above."
            />
          ) : (
            <ul className="space-y-4">
              {announcements.map((a) => (
                <li key={a.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                  <p className="font-medium">{a.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
