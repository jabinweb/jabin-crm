'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Pause, Users, Mail, TrendingUp } from 'lucide-react';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { PageHeaderSkeleton, CardListSkeleton } from '@/components/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { confirmAction } from '@/lib/confirm-action';

interface Sequence {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  _count: {
    steps: number;
    enrollments: number;
  };
}

export default function SequencesPage() {
  const router = useRouter();
  const { path } = useWorkspacePaths();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSequences();
  }, []);

  const fetchSequences = async () => {
    try {
      const res = await fetch('/api/sequences');
      if (res.ok) {
        const data = await res.json();
        setSequences(data);
      }
    } catch (error) {
      console.error('Failed to fetch sequences:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSequence = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/sequences/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (res.ok) {
        fetchSequences();
      }
    } catch (error) {
      console.error('Failed to toggle sequence:', error);
    }
  };

  const deleteSequence = async (id: string, name: string) => {
    const ok = await confirmAction({
      title: `Delete sequence "${name}"?`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/sequences/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete');
      }
      toast.success('Sequence deleted');
      fetchSequences();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete sequence');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <CardListSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Email Sequences</h1>
          <p className="text-muted-foreground">
            Automate your email outreach with multi-step sequences
          </p>
        </div>
        <DashboardLink href="/dashboard/sequences/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Sequence
          </Button>
        </DashboardLink>
      </div>

      {sequences.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Mail}
              title="No sequences yet"
              description="Create your first email sequence to automate outreach."
              actionLabel="Create Sequence"
              actionHref={path('/dashboard/sequences/new')}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sequences.map((sequence) => (
            <Card key={sequence.id} className="hover:shadow-none transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{sequence.name}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">
                      {sequence.description || 'No description'}
                    </CardDescription>
                  </div>
                  <Badge variant={sequence.isActive ? 'default' : 'secondary'}>
                    {sequence.isActive ? 'Active' : 'Paused'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{sequence._count.steps} steps</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{sequence._count.enrollments} enrolled</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(path(`/dashboard/sequences/${sequence.id}`))}
                    >
                      <TrendingUp className="mr-2 h-4 w-4" />
                      View Stats
                    </Button>
                    <Button
                      variant={sequence.isActive ? 'secondary' : 'default'}
                      size="sm"
                      onClick={() => toggleSequence(sequence.id, sequence.isActive)}
                    >
                      {sequence.isActive ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSequence(sequence.id, sequence.name)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

