'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLeadsPage } from '@/hooks/use-leads-page';
import { LeadsToolbar } from '@/components/leads/leads-toolbar';
import { LeadsFilters } from '@/components/leads/leads-filters';
import { LeadsTable } from '@/components/leads/leads-table';
import { LeadsDialogs } from '@/components/leads/leads-dialogs';
import { LeadsBoard } from '@/components/leads/leads-board';
import { LayoutGrid, List } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function LeadsPage() {
  const leads = useLeadsPage();
  const [view, setView] = useState<'list' | 'board'>('list');
  const queryClient = useQueryClient();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <LeadsToolbar {...leads} />
        <div className="flex gap-1 self-end sm:self-auto">
          <Button
            type="button"
            size="sm"
            variant={view === 'list' ? 'default' : 'outline'}
            onClick={() => setView('list')}
          >
            <List className="mr-1.5 h-4 w-4" />
            List
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === 'board' ? 'default' : 'outline'}
            onClick={() => setView('board')}
          >
            <LayoutGrid className="mr-1.5 h-4 w-4" />
            Board
          </Button>
        </div>
      </div>

      {view === 'list' ? (
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
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Lead pipeline</CardTitle>
            <CardDescription>Drag leads between stages to update status.</CardDescription>
          </CardHeader>
          <CardContent>
            <LeadsBoard
              leads={leads.data?.leads ?? []}
              onChanged={() => {
                queryClient.invalidateQueries({ queryKey: ['leads'] });
              }}
            />
          </CardContent>
        </Card>
      )}
      <LeadsDialogs {...leads} />
    </div>
  );
}
