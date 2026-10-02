'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertCircle,
  ArrowLeft,
  CircleStop,
  Loader2,
  Users,
  Mail,
  TrendingUp,
  Play,
  Pause,
} from 'lucide-react';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { CardListSkeleton, DetailSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { confirmAction } from '@/lib/confirm-action';

interface SequenceStats {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  steps: Array<{
    id: string;
    stepNumber: number;
    name: string;
    subject: string;
  }>;
  enrollments: {
    total: number;
    active: number;
    completed: number;
    stopped: number;
    paused: number;
  };
}

export default function SequenceDetailsPage() {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const sequenceId = routeParams.id;
  const { path } = useWorkspacePaths();
  const [stats, setStats] = useState<SequenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'not-found' | 'error' | null>(null);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [availableLeads, setAvailableLeads] = useState<any[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!sequenceId) return;
    try {
      const res = await fetch(`/api/sequences/${sequenceId}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setLoadError(null);
      } else {
        setLoadError(res.status === 404 ? 'not-found' : 'error');
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setLoadError('error');
    } finally {
      setLoading(false);
    }
  }, [sequenceId]);

  const fetchAvailableLeads = useCallback(async () => {
    setLeadsLoading(true);
    setLeadsError(false);
    try {
      const res = await fetch('/api/leads?limit=100');
      if (!res.ok) throw new Error('Failed to fetch leads');
      const data = await res.json();
      setAvailableLeads(data.leads || []);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
      setLeadsError(true);
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sequenceId) return;
    void fetchStats();
    void fetchAvailableLeads();
  }, [sequenceId, fetchStats, fetchAvailableLeads]);

  const toggleSequence = async () => {
    if (!stats || toggling) return;

    setToggling(true);
    try {
      const res = await fetch(`/api/sequences/${sequenceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !stats.isActive }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update sequence');
      }
      toast.success(stats.isActive ? 'Sequence paused' : 'Sequence activated');
      await fetchStats();
    } catch (error) {
      console.error('Failed to toggle sequence:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update sequence');
    } finally {
      setToggling(false);
    }
  };

  const enrollLeads = async () => {
    if (enrolling || selectedLeads.length === 0) return;
    setEnrolling(true);
    try {
      const res = await fetch(`/api/sequences/${sequenceId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedLeads }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to enroll leads');
      }
      const count = selectedLeads.length;
      setShowEnrollDialog(false);
      setSelectedLeads([]);
      void fetchStats();
      toast.success(`Enrolled ${count} ${count === 1 ? 'lead' : 'leads'}`);
    } catch (error) {
      console.error('Failed to enroll leads:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to enroll leads');
    } finally {
      setEnrolling(false);
    }
  };

  const toggleLead = (leadId: string) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  };

  const backLink = (
    <Button asChild variant="ghost" size="icon" className="-ml-2 h-10 w-10 sm:h-9 sm:w-9">
      <DashboardLink href="/dashboard/sequences" aria-label="Back to sequences">
        <ArrowLeft className="h-4 w-4" />
      </DashboardLink>
    </Button>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {backLink}
        <DetailSkeleton />
      </div>
    );
  }

  if (!stats) {
    const isError = loadError === 'error';
    return (
      <div className="space-y-4">
        {backLink}
        <Card>
          <EmptyState
            icon={AlertCircle}
            title={isError ? "Couldn't load this sequence" : 'Sequence not found'}
            description={
              isError
                ? 'Check your connection and try again.'
                : 'It may have been deleted, or you may not have access to it.'
            }
            actionLabel={isError ? 'Try again' : 'Back to sequences'}
            {...(isError
              ? {
                  onAction: () => {
                    setLoading(true);
                    void fetchStats();
                  },
                }
              : { actionHref: path('/dashboard/sequences') })}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          {backLink}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="break-words text-2xl font-bold tracking-tight">{stats.name}</h1>
              <Badge variant={stats.isActive ? 'default' : 'secondary'}>
                {stats.isActive ? 'Active' : 'Paused'}
              </Badge>
            </div>
            {stats.description ? (
              <p className="break-words text-muted-foreground">{stats.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowEnrollDialog(true)}>
            <Users className="mr-2 h-4 w-4" />
            Enroll Leads
          </Button>
          <Button
            variant={stats.isActive ? 'secondary' : 'default'}
            onClick={toggleSequence}
            disabled={toggling}
          >
            {toggling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {stats.isActive ? 'Pausing…' : 'Activating…'}
              </>
            ) : stats.isActive ? (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Activate
              </>
            )}
          </Button>
          {!stats.isActive && (
            <Button
              variant="outline"
              disabled={deleting}
              onClick={async () => {
                const ok = await confirmAction({
                  title: `Delete sequence "${stats.name}"?`,
                  description: 'This cannot be undone.',
                  confirmLabel: 'Delete',
                  variant: 'destructive',
                });
                if (!ok) return;
                setDeleting(true);
                try {
                  const res = await fetch(`/api/sequences/${sequenceId}`, {
                    method: 'DELETE',
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || 'Failed to delete sequence');
                  }
                  toast.success('Sequence deleted');
                  router.push(path('/dashboard/sequences'));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Failed to delete sequence');
                  setDeleting(false);
                }
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="truncate text-sm font-medium">Total Enrolled</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{stats.enrollments.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="truncate text-sm font-medium">Active</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{stats.enrollments.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="truncate text-sm font-medium">Completed</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{stats.enrollments.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="truncate text-sm font-medium">Stopped</CardTitle>
            <CircleStop className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{stats.enrollments.stopped}</div>
          </CardContent>
        </Card>
      </div>

      {/* Sequence Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Sequence Steps</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.steps.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              This sequence has no steps yet.
            </p>
          ) : (
          <div className="space-y-4">
            {stats.steps.map((step) => (
              <div key={step.id} className="flex items-start gap-3 p-3 border rounded-lg sm:gap-4 sm:p-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                  {step.stepNumber}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="break-words font-semibold">{step.name}</h4>
                  <p className="break-words text-sm text-muted-foreground mt-1">{step.subject}</p>
                </div>
              </div>
            ))}
          </div>
          )}
        </CardContent>
      </Card>

      {/* Enroll Dialog */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-h-[600px]">
          <DialogHeader>
            <DialogTitle>Enroll Leads in Sequence</DialogTitle>
            <DialogDescription>
              Select leads to enroll in this email sequence
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {leadsLoading ? (
              <CardListSkeleton rows={4} />
            ) : leadsError ? (
              <EmptyState
                icon={AlertCircle}
                title="Couldn't load leads"
                description="Check your connection and try again."
                actionLabel="Try again"
                onAction={() => void fetchAvailableLeads()}
                className="py-8"
              />
            ) : availableLeads.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No leads yet"
                description="Add leads first, then enroll them in this sequence."
                actionLabel="Go to Leads"
                actionHref={path('/dashboard/leads')}
                className="py-8"
              />
            ) : (
              availableLeads.map((lead) => (
                // A <label> keeps row-click and checkbox-click to a single toggle.
                <label
                  key={lead.id}
                  htmlFor={`enroll-lead-${lead.id}`}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-accent"
                >
                  <Checkbox
                    id={`enroll-lead-${lead.id}`}
                    checked={selectedLeads.includes(lead.id)}
                    onCheckedChange={() => toggleLead(lead.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{lead.companyName}</p>
                    <p className="break-words text-sm text-muted-foreground">
                      {lead.email || 'No email'} {lead.contactName && `• ${lead.contactName}`}
                    </p>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnrollDialog(false)}>
              Cancel
            </Button>
            <Button onClick={enrollLeads} disabled={selectedLeads.length === 0 || enrolling}>
              {enrolling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enroll {selectedLeads.length} Lead{selectedLeads.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
