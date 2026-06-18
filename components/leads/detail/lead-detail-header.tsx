'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  Building,
  ExternalLink,
  Linkedin,
  User,
  ListChecks,
  Target,
} from 'lucide-react';
import { LeadScoreBadge } from '@/components/crm/lead-score-badge';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { getLeadDisplayScore, type LeadStatus } from '@/types/lead';
import { type useLeadDetailPage } from '@/hooks/use-lead-detail-page';

type LeadDetailPageState = ReturnType<typeof useLeadDetailPage>;

interface LeadDetailHeaderProps extends Pick<
  LeadDetailPageState,
  | 'lead'
  | 'setComposeOpen'
  | 'setShowEnrollSequenceDialog'
  | 'setShowCreateTaskDialog'
  | 'setShowCreateDealDialog'
  | 'handleConvertLead'
> {}

function getStatusVariant(status: LeadStatus) {
  if (status === 'CONVERTED' || status === 'QUALIFIED') return 'default';
  if (status === 'RESPONDED' || status === 'CONTACTED') return 'secondary';
  if (status === 'LOST' || status === 'UNSUBSCRIBED') return 'destructive';
  return 'outline';
}

export function LeadDetailHeader({
  lead,
  setComposeOpen,
  setShowEnrollSequenceDialog,
  setShowCreateTaskDialog,
  setShowCreateDealDialog,
  handleConvertLead,
}: LeadDetailHeaderProps) {
  if (!lead) return null;

  const displayScore = getLeadDisplayScore(lead);

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 rounded-lg border p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <Button variant="ghost" size="icon" asChild>
            <DashboardLink href="/dashboard/leads">
              <ArrowLeft className="h-5 w-5" />
            </DashboardLink>
          </Button>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                {lead.companyName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{lead.companyName}</h1>
                <div className="flex items-center gap-2 mt-1">
                  {lead.contactName && (
                    <p className="text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {lead.contactName}
                      {lead.jobTitle && ` · ${lead.jobTitle}`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 hover:underline font-medium"
                >
                  <Mail className="h-4 w-4" />
                  {lead.email}
                </a>
              )}
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-1.5 text-slate-600 hover:text-slate-700 hover:underline"
                >
                  <Phone className="h-4 w-4" />
                  {lead.phone}
                </a>
              )}
              {lead.website && (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-slate-600 hover:text-slate-700 hover:underline"
                >
                  <Globe className="h-4 w-4" />
                  Website
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          {displayScore !== undefined && (
            <LeadScoreBadge score={displayScore} showNumber={true} size="lg" />
          )}
          <Badge className="text-sm px-3 py-1" variant={getStatusVariant(lead.status)}>
            {lead.status}
          </Badge>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setComposeOpen(true)} className="gap-2">
              <Mail className="h-4 w-4" />
              Send Email
            </Button>
            {lead.phone && (
              <Button size="sm" variant="outline" asChild className="gap-2">
                <a href={`tel:${lead.phone}`}>
                  <Phone className="h-4 w-4" />
                  Call
                </a>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEnrollSequenceDialog(true)}
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              Enroll in Sequence
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreateTaskDialog(true)}
              className="gap-2"
            >
              <ListChecks className="h-4 w-4" />
              Create Task
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreateDealDialog(true)}
              className="gap-2"
            >
              <Target className="h-4 w-4" />
              Create Deal
            </Button>
            {lead.status !== 'CONVERTED' && (
              <Button size="sm" variant="default" className="gap-2" onClick={handleConvertLead}>
                <Building className="h-4 w-4" />
                Convert to Customer
              </Button>
            )}
            {lead.linkedinUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer">
                  <Linkedin className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
