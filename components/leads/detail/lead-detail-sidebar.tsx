'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Building, MapPin, Calendar, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { LeadScoreBadge } from '@/components/crm/lead-score-badge';
import { getLeadDisplayScore } from '@/types/lead';
import { CardListSkeleton } from '@/components/loading';
import { type useLeadDetailPage } from '@/hooks/use-lead-detail-page';

type LeadDetailPageState = ReturnType<typeof useLeadDetailPage>;

interface LeadDetailSidebarProps extends Pick<
  LeadDetailPageState,
  | 'lead'
  | 'emailSnapshot'
  | 'emailsLoading'
  | 'setComposeOpen'
> {}

export function LeadDetailSidebar({
  lead,
  emailSnapshot,
  emailsLoading,
  setComposeOpen,
}: LeadDetailSidebarProps) {
  if (!lead) return null;

  const displayScore = getLeadDisplayScore(lead);

  return (
    <div className="space-y-6">
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Building className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            Company Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {displayScore !== undefined && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lead Score</p>
              <LeadScoreBadge score={displayScore} showNumber={true} size="md" />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-1">
            {lead.industry && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Industry</p>
                <Badge variant="outline" className="font-normal">{lead.industry}</Badge>
              </div>
            )}

            {lead.employeeCount && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Company Size</p>
                <p className="text-sm font-semibold">{lead.employeeCount} employees</p>
              </div>
            )}

            {lead.address && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</p>
                <p className="text-sm flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  {lead.address}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Added</p>
              <p className="text-sm flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                {format(new Date(lead.createdAt), 'PP')}
              </p>
            </div>
          </div>

          {lead.description && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Description</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{lead.description}</p>
            </div>
          )}

          {lead.sourceUrl && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Source</p>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="font-normal">{lead.source}</Badge>
                <a
                  href={lead.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  View Source
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <Mail className="h-4 w-4 text-white" />
            </div>
            Email Conversations
          </CardTitle>
          <CardDescription>Recent emails and reply activity</CardDescription>
        </CardHeader>
        <CardContent>
          {emailsLoading ? (
            <CardListSkeleton rows={3} />
          ) : emailSnapshot && emailSnapshot.length > 0 ? (
            <div className="space-y-3">
              {emailSnapshot.map((em) => (
                <div
                  key={em.id}
                  className="bg-white dark:bg-slate-900 rounded-lg p-3 border hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium text-sm line-clamp-1 flex-1">{em.subject || '(No subject)'}</h4>
                    {em.replyCount && em.replyCount > 0 && (
                      <Badge variant="default" className="shrink-0 bg-green-600">
                        {em.replyCount} {em.replyCount === 1 ? 'reply' : 'replies'}
                      </Badge>
                    )}
                  </div>

                  {em.latestReply?.body && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      <span className="font-medium">Latest: </span>
                      {em.latestReply.body}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {em.sentAt ? format(new Date(em.sentAt), 'MMM d, h:mm a') : ''}
                    </span>
                    <DashboardLink
                      href={`/dashboard/emails?search=${encodeURIComponent(em.subject || '')}`}
                      className="text-green-600 hover:text-green-700 hover:underline font-medium"
                    >
                      View Thread →
                    </DashboardLink>
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 bg-white dark:bg-slate-900"
                onClick={() => setComposeOpen(true)}
              >
                <Mail className="h-3 w-3 mr-2" />
                Send New Email
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-3">
                <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">No emails sent yet</p>
              <Button
                size="sm"
                onClick={() => setComposeOpen(true)}
                className="bg-gradient-to-r from-green-500 to-emerald-500"
              >
                <Mail className="h-3 w-3 mr-2" />
                Start Conversation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
