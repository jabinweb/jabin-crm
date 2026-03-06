'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
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
import { Progress } from '@/components/ui/progress';
import {
  Mail,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Eye,
  MousePointerClick,
  UserCheck,
} from 'lucide-react';
import { format } from 'date-fns';

export default function CampaignsPage() {
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, refetch } = useQuery({
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

    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const handleSendCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to send this campaign?')) return;

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('Campaign sent successfully!');
        refetch();
      } else {
        alert('Failed to send campaign');
      }
    } catch (error) {
      console.error('Error sending campaign:', error);
      alert('Error sending campaign');
    }
  };

  return (
    <div className="container mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Email Campaigns</h2>
        <Link href="/dashboard/campaigns/new">
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.pagination?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.campaigns?.reduce((acc: number, c: any) => acc + c.sentCount, 0) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Opens</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.campaigns?.reduce((acc: number, c: any) => acc + c.openCount, 0) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
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
            <div className="flex justify-center py-8">Loading campaigns...</div>
          ) : !data?.campaigns || data.campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No campaigns yet. Create your first campaign to get started.
            </div>
          ) : (
            <div className="space-y-4">
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
                    <TableHead>Actions</TableHead>
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
                          <Link
                            href={`/dashboard/campaigns/${campaign.id}`}
                            className="hover:underline"
                          >
                            {campaign.name}
                          </Link>
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
                          <div className="flex space-x-2">
                            {campaign.status === 'DRAFT' && (
                              <Button
                                size="sm"
                                onClick={() => handleSendCampaign(campaign.id)}
                              >
                                <Send className="mr-1 h-3 w-3" />
                                Send
                              </Button>
                            )}
                            <Link href={`/dashboard/campaigns/${campaign.id}`}>
                              <Button size="sm" variant="outline">
                                View
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data.pagination && data.pagination.pages > 1 && (
                <div className="flex items-center justify-between">
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
