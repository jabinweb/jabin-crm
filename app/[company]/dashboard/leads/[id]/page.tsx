'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, SearchX } from 'lucide-react';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { useLeadDetailPage } from '@/hooks/use-lead-detail-page';
import { LeadDetailHeader } from '@/components/leads/detail/lead-detail-header';
import { LeadDetailSidebar } from '@/components/leads/detail/lead-detail-sidebar';
import { LeadDetailActivity } from '@/components/leads/detail/lead-detail-activity';
import { LeadDetailActions } from '@/components/leads/detail/lead-detail-actions';
import { LeadDetailDialogs } from '@/components/leads/detail/lead-detail-dialogs';
import { LeadDocuments } from '@/components/leads/lead-documents';
import { DetailSkeleton } from '@/components/loading';

export default function LeadDetailPage() {
  const detail = useLeadDetailPage();

  if (detail.isLoading) {
    return <DetailSkeleton />;
  }

  if (detail.leadError && !detail.lead) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
        <p className="text-base font-semibold">We couldn&apos;t load this lead</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Something went wrong while fetching the lead. Check your connection and try again.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button variant="outline" asChild>
            <DashboardLink href="/dashboard/leads">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to leads
            </DashboardLink>
          </Button>
          <Button onClick={() => detail.refetchLead()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!detail.lead) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
        <div className="rounded-full bg-muted p-3 text-muted-foreground">
          <SearchX className="h-6 w-6" />
        </div>
        <p className="text-base font-semibold">Lead not found</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          It may have been deleted or you may not have access to it.
        </p>
        <Button asChild className="mt-2">
          <DashboardLink href="/dashboard/leads">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to leads
          </DashboardLink>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LeadDetailHeader {...detail} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2 space-y-6">
          <LeadDetailActions {...detail} />
          <LeadDetailActivity {...detail} />
          <LeadDocuments leadId={detail.lead.id} />
        </div>
        <LeadDetailSidebar {...detail} />
      </div>
      <LeadDetailDialogs {...detail} />
    </div>
  );
}
