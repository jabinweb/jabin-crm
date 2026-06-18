'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { useLeadDetailPage } from '@/hooks/use-lead-detail-page';
import { LeadDetailHeader } from '@/components/leads/detail/lead-detail-header';
import { LeadDetailSidebar } from '@/components/leads/detail/lead-detail-sidebar';
import { LeadDetailActivity } from '@/components/leads/detail/lead-detail-activity';
import { LeadDetailActions } from '@/components/leads/detail/lead-detail-actions';
import { LeadDetailDialogs } from '@/components/leads/detail/lead-detail-dialogs';

export default function LeadDetailPage() {
  const detail = useLeadDetailPage();

  if (detail.isLoading) {
    return (
      <div className="flex-1 space-y-4">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!detail.lead) {
    return (
      <div className="flex-1 space-y-4">
        <div className="text-center py-8">
          <p className="text-red-500">Lead not found</p>
          <Button asChild className="mt-4">
            <DashboardLink href="/dashboard/leads">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Leads
            </DashboardLink>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 pb-8">
      <LeadDetailHeader {...detail} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <LeadDetailActions {...detail} />
          <LeadDetailActivity {...detail} />
        </div>
        <LeadDetailSidebar {...detail} />
      </div>
      <LeadDetailDialogs {...detail} />
    </div>
  );
}
