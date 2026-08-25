'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLeadsPage } from '@/hooks/use-leads-page';
import { LeadsToolbar } from '@/components/leads/leads-toolbar';
import { LeadsFilters } from '@/components/leads/leads-filters';
import { LeadsTable } from '@/components/leads/leads-table';
import { LeadsDialogs } from '@/components/leads/leads-dialogs';
import { LeadsBoard } from '@/components/leads/leads-board';
import { LayoutGrid, List } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export default function LeadsPage() {
  const leads = useLeadsPage();
  const [view, setView] = useState<'list' | 'board'>('list');
  const queryClient = useQueryClient();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <LeadsToolbar {...leads} />
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => {
            if (v === 'list' || v === 'board') setView(v);
          }}
          variant="outline"
          size="sm"
          className="justify-start self-end sm:self-auto"
        >
          <ToggleGroupItem value="list" aria-label="List view" className="gap-1.5 px-3">
            <List className="size-3.5" />
            List
          </ToggleGroupItem>
          <ToggleGroupItem value="board" aria-label="Board view" className="gap-1.5 px-3">
            <LayoutGrid className="size-3.5" />
            Board
          </ToggleGroupItem>
        </ToggleGroup>
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
