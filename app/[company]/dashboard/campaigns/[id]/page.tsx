'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Mail,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  MousePointerClick,
  UserCheck,
  AlertCircle,
  MoreVertical,
  Loader2,
  Calendar,
  Users,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const campaignId = params.id as string;

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}`);
      if (!response.ok) throw new Error('Failed to fetch campaign');
      return response.json();
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send campaign');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Campaign sent successfully!');
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send campaign');
    },
  });

  const handleSend = () => {
    if (!confirm('Are you sure you want to send this campaign?')) return;
    sendMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <XCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">Campaign not found</p>
        <DashboardLink href="/dashboard/campaigns">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Campaigns
          </Button>
        </DashboardLink>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const config: any = {
      DRAFT: { variant: 'secondary', icon: Clock },
      SCHEDULED: { variant: 'default', icon: Calendar },
      SENDING: { variant: 'default', icon: Send },
      SENT: { variant: 'default', icon: CheckCircle },
      PAUSED: { variant: 'secondary', icon: AlertCircle },
      CANCELLED: { variant: 'destructive', icon: XCircle },
    };

    const { variant, icon: Icon } = config[status] || config.DRAFT;
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const openRate =
    campaign.sentCount > 0
      ? ((campaign.openCount / campaign.sentCount) * 100).toFixed(1)
      : '0.0';
  const clickRate =
    campaign.sentCount > 0
      ? ((campaign.clickCount / campaign.sentCount) * 100).toFixed(1)
      : '0.0';
  const replyRate =
    campaign.sentCount > 0
      ? ((campaign.replyCount / campaign.sentCount) * 100).toFixed(1)
      : '0.0';

  // Calculate performance by category
  const getPerformanceByCategory = (category: 'status' | 'industry' | 'source') => {
    if (!campaign.emailCampaignLeads) return [];
    
    const stats: any = {};
    campaign.emailCampaignLeads.forEach((cl: any) => {
      const key = cl.lead?.[category] || 'Unknown';
      if (!stats[key]) {
        stats[key] = { 
          name: key, 
          total: 0, 
          sent: 0, 
          opened: 0, 
          clicked: 0, 
          replied: 0 
        };
      }
      stats[key].total++;
      if (cl.status === 'SENT') {
        stats[key].sent++;
        // Note: We'd need email event tracking to get accurate open/click/reply data per lead
      }
    });
    
    return Object.values(stats).sort((a: any, b: any) => b.total - a.total);
  };

  const statusBreakdown = getPerformanceByCategory('status');
  const industryBreakdown = getPerformanceByCategory('industry');
  const sourceBreakdown = getPerformanceByCategory('source');

  return (
    <div className="flex-1 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <DashboardLink href="/dashboard/campaigns">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </DashboardLink>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">{campaign.name}</h2>
              <p className="text-muted-foreground">{campaign.subject}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(campaign.status)}
          {campaign.status === 'DRAFT' && (
            <Button onClick={handleSend} disabled={sendMutation.isPending}>
              {sendMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send Campaign
            </Button>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recipients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.totalRecipients}</div>
            <p className="text-xs text-muted-foreground">
              {campaign.sentCount} sent
            </p>
            {campaign.totalRecipients > 0 && (
              <Progress
                value={(campaign.sentCount / campaign.totalRecipients) * 100}
                className="mt-2"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openRate}%</div>
            <p className="text-xs text-muted-foreground">
              {campaign.openCount} opened
            </p>
            <Progress value={parseFloat(openRate)} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clickRate}%</div>
            <p className="text-xs text-muted-foreground">
              {campaign.clickCount} clicks
            </p>
            <Progress value={parseFloat(clickRate)} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{replyRate}%</div>
            <p className="text-xs text-muted-foreground">
              {campaign.replyCount} replies
            </p>
            <Progress value={parseFloat(replyRate)} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Campaign Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Email Content */}
          <Card>
            <CardHeader>
              <CardTitle>Email Content</CardTitle>
              <CardDescription>Preview of your campaign email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Subject Line</p>
                <p className="text-lg font-semibold mt-1">{campaign.subject}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Email Body</p>
                <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm">
                  {campaign.emailTemplate}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance by Category */}
          {campaign.status === 'SENT' && (
            <Card>
              <CardHeader>
                <CardTitle>Performance by Category</CardTitle>
                <CardDescription>Campaign results segmented by lead attributes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* By Status */}
                {statusBreakdown.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      📊 By Lead Status
                    </h4>
                    <div className="space-y-2">
                      {statusBreakdown.map((stat: any) => (
                        <div key={stat.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="min-w-[100px]">
                              {stat.name}
                            </Badge>
                            <span className="text-muted-foreground">
                              {stat.sent}/{stat.total} sent
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium">
                              {stat.total > 0 ? ((stat.sent / stat.total) * 100).toFixed(0) : 0}% delivered
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* By Industry */}
                {industryBreakdown.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      🏢 By Industry
                    </h4>
                    <div className="space-y-2">
                      {industryBreakdown.slice(0, 5).map((stat: any) => (
                        <div key={stat.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="min-w-[120px]">
                              {stat.name}
                            </Badge>
                            <span className="text-muted-foreground">
                              {stat.sent}/{stat.total} sent
                            </span>
                          </div>
                          <Progress 
                            value={stat.total > 0 ? (stat.sent / stat.total) * 100 : 0} 
                            className="w-[100px]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* By Source */}
                {sourceBreakdown.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      📍 By Source
                    </h4>
                    <div className="space-y-2">
                      {sourceBreakdown.map((stat: any) => (
                        <div key={stat.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="min-w-[120px]">
                              {stat.name}
                            </Badge>
                            <span className="text-muted-foreground">
                              {stat.sent}/{stat.total} sent
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium">
                              {((stat.sent / campaign.sentCount) * 100).toFixed(0)}% of campaign
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recipients List */}
          <Card>
            <CardHeader>
              <CardTitle>Recipients</CardTitle>
              <CardDescription>
                {campaign._count?.emailCampaignLeads || 0} lead(s) in this campaign
              </CardDescription>
            </CardHeader>
            <CardContent>
              {campaign.emailCampaignLeads && campaign.emailCampaignLeads.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaign.emailCampaignLeads.map((campaignLead: any) => (
                      <TableRow key={campaignLead.id}>
                        <TableCell className="font-medium">
                          {campaignLead.lead?.companyName || 'N/A'}
                        </TableCell>
                        <TableCell>{campaignLead.lead?.email || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              campaignLead.status === 'SENT'
                                ? 'default'
                                : campaignLead.status === 'FAILED'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {campaignLead.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {campaignLead.sentAt
                            ? format(new Date(campaignLead.sentAt), 'MMM d, yyyy h:mm a')
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>No recipients added to this campaign yet.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Campaign Info */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">From</p>
                <p className="mt-1">
                  {campaign.fromName} &lt;{campaign.fromEmail}&gt;
                </p>
              </div>
              {campaign.replyTo && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Reply-To</p>
                    <p className="mt-1">{campaign.replyTo}</p>
                  </div>
                </>
              )}
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p className="mt-1">
                  {format(new Date(campaign.createdAt), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              {campaign.scheduledAt && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Scheduled For</p>
                    <p className="mt-1">
                      {format(new Date(campaign.scheduledAt), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </>
              )}
              {campaign.sentAt && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Sent</p>
                    <p className="mt-1">
                      {format(new Date(campaign.sentAt), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Performance Summary */}
          {campaign.status === 'SENT' && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Delivery Rate</span>
                  <span className="font-semibold">
                    {campaign.totalRecipients > 0
                      ? (
                          ((campaign.sentCount - campaign.bounceCount) /
                            campaign.totalRecipients) *
                          100
                        ).toFixed(1)
                      : '0.0'}
                    %
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Bounces</span>
                  <span className="font-semibold">{campaign.bounceCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Unsubscribes</span>
                  <span className="font-semibold">{campaign.unsubscribeCount}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
