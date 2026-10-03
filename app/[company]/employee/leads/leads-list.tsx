'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Target } from 'lucide-react'
import { columns } from '@/components/employee/employee-leads-columns'
import { DataTable } from '@/components/table/data-table'
import { LeadStatus, CompanyTaskPriority } from '@prisma/client'
import { useLeads } from '@/hooks/use-leads'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import {
  EssEmptyState,
  EssErrorState,
  humanizeStatus,
} from '@/components/employee/mobile/ess-states'

type FilterState = {
  [key: string]: string[]
}

export function LeadsList() {
  const { employeePath } = useWorkspacePaths()
  const [filters, setFilters] = useState<FilterState>({
    status: [],
    priority: []
  })

  const { data, isLoading, isError, refetch } = useLeads({
    status: filters.status as LeadStatus[],
    priority: filters.priority as CompanyTaskPriority[],
    enabled: true
  })

  const filterableColumns = useMemo(() => ({
    status: {
      title: "Status",
      options: Object.values(LeadStatus).map(status => ({
        label: humanizeStatus(status),
        value: status
      }))
    },
    priority: {
      title: "Priority",
      options: Object.values(CompanyTaskPriority).map(priority => ({
        label: humanizeStatus(priority),
        value: priority
      }))
    }
  }), [])

  const leads = data?.data || []
  const hasFilters = Object.values(filters).some((values) => values.length > 0)
  const newLeadHref = employeePath('/employee/leads/new')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">My leads</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track the leads assigned to you
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href={newLeadHref}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add lead
          </Link>
        </Button>
      </div>

      {isError ? (
        <EssErrorState
          message="We couldn't load your leads."
          onRetry={() => void refetch()}
        />
      ) : !isLoading && leads.length === 0 && !hasFilters ? (
        <EssEmptyState
          icon={Target}
          title="No leads yet"
          description="Add a lead you're working on, or ask your manager to assign some to you."
          action={
            <Button asChild size="sm">
              <Link href={newLeadHref}>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Add lead
              </Link>
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={leads}
          isLoading={isLoading}
          searchableColumn="title"
          filterableColumns={filterableColumns}
          onFiltersChange={setFilters}
        />
      )}
    </div>
  )
}
