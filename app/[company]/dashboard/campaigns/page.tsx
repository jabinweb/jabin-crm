'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  Loader2,
  Mail,
  Send,
  Plus,
  Eye,
  MousePointerClick,
} from 'lucide-react';
import { FullTableSkeleton } from '@/components/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { confirmAction } from '@/lib/confirm-action';
import { humanizeEnum } from '@/lib/crm/humanize-enum';

export default function CampaignsPage() {
  const { path } = useWorkspacePaths();
  const [page, setPage] = useState(1);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const limit = 10;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['campaigns', { page, limit }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await fetch(`/api/campaigns?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }
      return response.json();
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: any = {
      DRAFT: 'secondary',
      SCHEDULED: 'default',
      SENDING: 'default',
      SENT: 'default',
      PAUSED: 'secondary',
      CANCELLED: 'destructive',
    };

    return <Badge variant={variants[status] || 'default'}>{humanizeEnum(status)}</Badge>;
  };

  const handleSendCampaign = async (campaignId: string) => {
    const ok = await confirmAction({
      title: 'Send this campaign?',
      description: 'Emails go out to every recipient right away. This cannot be undone.',
      confirmLabel: 'Send',
    });
    if (!ok) return;

    setPendingId(campaignId);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Campaign sent');
        refetch();
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || 'Failed to send campaign');
      }
    } catch (error) {
      console.error('Error sending campaign:', error);
      toast.error('Failed to send campaign');
    } finally {
      setPendingId(null);
    }
  };

  const handleDeleteDraft = async (campaignId: string) => {
    const ok = await confirmAction({
      title: 'Delete this draft campaign?',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    setPendingId(campaignId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to delete campaign');
        return;
      }
      toast.success('Draft deleted');
      refetch();
    } catch {
      toast.error('Failed to delete campaign');
    } finally {
      setPendingId(null);
    }
  };

  const multiPage = (data?.pagination?.pages ?? 1) > 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Email Campaigns</h1>
          <p className="text-muted-foreground">
            Send one-off emails to a group of leads and track opens and clicks.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <DashboardLink href="/dashboard/campaigns/new">
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </DashboardLink>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="truncate text-sm font-medium">Total Campaigns</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{data?.pagination?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="truncate text-sm font-medium">Emails Sent{multiPage ? ' (this page)' : ''}</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {data?.campaigns?.reduce((acc: number, c: any) => acc + c.sentCount, 0) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="truncate text-sm font-medium">Opens{multiPage ? ' (this page)' : ''}</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {data?.campaigns?.reduce((acc: number, c: any) => acc + c.openCount, 0) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="truncate text-sm font-medium">Clicks{multiPage ? ' (this page)' : ''}</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {data?.campaigns?.reduce((acc: number, c: any) => acc + c.clickCount, 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Campaigns</CardTitle>
          <CardDescription>
            Manage and track your email campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <FullTableSkeleton columnCount={8} rowCount={5} />
          ) : isError ? (
            <EmptyState
              icon={AlertCircle}
              title="Couldn't load campaigns"
              description="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => void refetch()}
            />
          ) : !data?.campaigns || data.campaigns.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No campaigns yet"
              description="Pick some leads, write the email, then send it or save it as a draft."
              actionLabel="New Campaign"
              actionHref={path('/dashboard/campaigns/new')}
            />
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 md:hidden">
                {data.campaigns.map((campaign: any) => (
                  <div key={campaign.id} className="rounded-xl border bg-card">
                    <DashboardLink
                      href={`/dashboard/campaigns/${campaign.id}`}
                      className="block space-y-1 p-3 active:bg-muted/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate font-medium">{campaign.name}</p>
                        <div className="shrink-0">{getStatusBadge(campaign.status)}</div>
                      </div>
                      {campaign.subject ? (
                        <p className="truncate text-sm text-muted-foreground">{campaign.subject}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Sent {campaign.sentCount}/{campaign.totalRecipients} · Opens {campaign.openCount} · Clicks {campaign.clickCount} · {format(new Date(campaign.createdAt), 'MMM d, yyyy')}
                      </p>
                    </DashboardLink>
                    {campaign.status === 'DRAFT' ? (
                      <div className="flex gap-2 border-t p-2">
                        <Button
                          size="sm"
                          className="h-10 flex-1"
                          disabled={pendingId === campaign.id}
                          onClick={() => handleSendCampaign(campaign.id)}
                        >
                          {pendingId === campaign.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="mr-1 h-3 w-3" />
                          )}
                          Send
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-10 flex-1"
                          disabled={pendingId === campaign.id}
                          onClick={() => void handleDeleteDraft(campaign.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Opens</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.campaigns.map((campaign: any) => {
                    const openRate = campaign.sentCount > 0
                      ? ((campaign.openCount / campaign.sentCount) * 100).toFixed(1)
                      : '0';
                    const clickRate = campaign.sentCount > 0
                      ? ((campaign.clickCount / campaign.sentCount) * 100).toFixed(1)
                      : '0';

                    return (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">
                          <DashboardLink
                            href={`/dashboard/campaigns/${campaign.id}`}
                            className="hover:underline"
                          >
                            {campaign.name}
                          </DashboardLink>
                          <div className="text-sm text-muted-foreground">
                            {campaign.subject}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                        <TableCell>{campaign.totalRecipients}</TableCell>
                        <TableCell>
                          {campaign.sentCount}
                          <div className="text-xs text-muted-foreground">
                            {campaign.totalRecipients > 0 &&
                              `${((campaign.sentCount / campaign.totalRecipients) * 100).toFixed(0)}%`}
                          </div>
                        </TableCell>
                        <TableCell>
                          {campaign.openCount}
                          <div className="text-xs text-muted-foreground">{openRate}%</div>
                        </TableCell>
                        <TableCell>
                          {campaign.clickCount}
                          <div className="text-xs text-muted-foreground">{clickRate}%</div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(campaign.createdAt), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {campaign.status === 'DRAFT' && (
                              <Button
                                size="sm"
                                disabled={pendingId === campaign.id}
                                onClick={() => handleSendCampaign(campaign.id)}
                              >
                                {pendingId === campaign.id ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <Send className="mr-1 h-3 w-3" />
                                )}
                                Send
                              </Button>
                            )}
                            {campaign.status === 'DRAFT' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={pendingId === campaign.id}
                                onClick={() => void handleDeleteDraft(campaign.id)}
                              >
                                Delete
                              </Button>
                            )}
                            <Button asChild size="sm" variant="outline">
                              <DashboardLink href={`/dashboard/campaigns/${campaign.id}`}>
                                View
                              </DashboardLink>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>

              {/* Pagination */}
              {data.pagination && data.pagination.pages > 1 && (
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {data.pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page === data.pagination.pages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
