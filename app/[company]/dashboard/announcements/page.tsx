'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Loader2, Megaphone, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { CardListSkeleton } from '@/components/loading';
import { QueryErrorState } from '@/components/hr/hr-ui';
import { format } from 'date-fns';

const SELECT_CLASS =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm';

type Announcement = {
  id: string;
  title: string;
  content: string;
  priority: number;
  createdAt: string;
  targetDepartmentId?: string | null;
  targetBranchId?: string | null;
};

type OrgOption = { id: string; name: string };

export default function AnnouncementsAdminPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetDepartmentId, setTargetDepartmentId] = useState('');
  const [targetBranchId, setTargetBranchId] = useState('');

  const {
    data: announcements = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const res = await fetch('/api/employee/announcements');
      if (!res.ok) throw new Error('Failed to load');
      return (await res.json()) as Announcement[];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['ann-departments'],
    queryFn: async () => {
      const res = await fetch('/api/hr/departments');
      if (!res.ok) return [];
      return (await res.json()) as OrgOption[];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['ann-branches'],
    queryFn: async () => {
      const res = await fetch('/api/hr/branches');
      if (!res.ok) return [];
      return (await res.json()) as OrgOption[];
    },
  });

  const audienceLabel = (a: Announcement) => {
    const parts = [
      a.targetDepartmentId
        ? departments.find((d) => d.id === a.targetDepartmentId)?.name ?? 'One department'
        : null,
      a.targetBranchId
        ? branches.find((b) => b.id === a.targetBranchId)?.name ?? 'One branch'
        : null,
    ].filter(Boolean);
    return parts.length ? `Visible to ${parts.join(', ')}` : 'Everyone';
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setTargetDepartmentId('');
    setTargetBranchId('');
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/employee/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          priority: 0,
          targetDepartmentId: targetDepartmentId || undefined,
          targetBranchId: targetBranchId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Announcement published');
      resetForm();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
          <p className="text-sm text-muted-foreground">
            Post company-wide updates visible in the employee portal.
          </p>
        </div>
        <Button onClick={openCreate} className="self-start">
          <Plus className="mr-2 h-4 w-4" />
          New announcement
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <CardListSkeleton rows={4} />
          ) : isError ? (
            <QueryErrorState title="Couldn’t load announcements" onRetry={() => void refetch()} />
          ) : announcements.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No announcements yet"
              description="Publish your first company update."
              actionLabel="New announcement"
              onAction={openCreate}
            />
          ) : (
            <ul className="space-y-4">
              {announcements.map((a) => (
                <li key={a.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                  <p className="break-words font-medium">{a.title}</p>
                  <p className="mt-1 break-words text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {format(new Date(a.createdAt), 'd MMM yyyy, h:mm a')}
                    {' · '}
                    {audienceLabel(a)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New announcement</DialogTitle>
            <DialogDescription>
              Publish a company update visible in the employee portal.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ann-dept">Department (optional)</Label>
                <select
                  id="ann-dept"
                  className={SELECT_CLASS}
                  value={targetDepartmentId}
                  onChange={(e) => setTargetDepartmentId(e.target.value)}
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-branch">Branch (optional)</Label>
                <select
                  id="ann-branch"
                  className={SELECT_CLASS}
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                >
                  <option value="">All branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!title.trim() || !content.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
