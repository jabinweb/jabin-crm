'use client'

import { useQuery } from '@tanstack/react-query'
import { DataTable } from '@/components/table/data-table'
import { columns } from '@/components/employee/employee-leads-columns'
import { CalendarCheck } from 'lucide-react'
import { EssEmptyState, EssErrorState } from '@/components/employee/mobile/ess-states'

export default function FollowUpLeadsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['followUpLeads'],
    queryFn: async () => {
      const response = await fetch('/api/employee/leads/follow-up')
      if (!response.ok) throw new Error('Failed to fetch follow-ups')
      return response.json()
    }
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Follow-ups</h1>
        <p className="text-sm text-muted-foreground">
          Leads waiting on your next call, email or meeting
        </p>
      </div>

      {isError ? (
        <EssErrorState
          message="We couldn't load your follow-ups."
          onRetry={() => void refetch()}
        />
      ) : !isLoading && (data?.leads ?? []).length === 0 ? (
        <EssEmptyState
          icon={CalendarCheck}
          title="You're all caught up"
          description="No leads need a follow-up right now. Leads with a due follow-up will appear here."
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.leads || []}
          isLoading={isLoading}
          searchableColumn="title"
        />
      )}
    </div>
  )
}
