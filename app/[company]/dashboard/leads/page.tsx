'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLeadsPage } from '@/hooks/use-leads-page';
import { LeadsToolbar } from '@/components/leads/leads-toolbar';
import { LeadsFilters } from '@/components/leads/leads-filters';
import { LeadsTable } from '@/components/leads/leads-table';
import { LeadsDialogs } from '@/components/leads/leads-dialogs';

export default function LeadsPage() {
  const leads = useLeadsPage();

  return (
    <div className="space-y-4">
      <LeadsToolbar {...leads} />
      <Card>
        <CardHeader>
          <CardTitle>Lead Management</CardTitle>
          <CardDescription>
            Search, filter, and manage your collected leads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadsFilters {...leads} />
          <LeadsTable {...leads} />
        </CardContent>
      </Card>
      <LeadsDialogs {...leads} />
    </div>
  );
}
