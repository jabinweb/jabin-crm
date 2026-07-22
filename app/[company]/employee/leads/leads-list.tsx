'use client'

import { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { columns } from '@/components/employee/employee-leads-columns'
import { DataTable } from '@/components/table/data-table'
import { LeadStatus, CompanyTaskPriority } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { useLeads } from '@/hooks/use-leads'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'

type FilterState = {
  [key: string]: string[]
}

export function LeadsList() {
  const router = useRouter()
  const { employeePath } = useWorkspacePaths()
  const { data: session } = useSession()
  const [filters, setFilters] = useState<FilterState>({
    status: [],
    priority: []
  })

  const { data, isLoading } = useLeads({
    status: filters.status as LeadStatus[],
    priority: filters.priority as CompanyTaskPriority[],
    enabled: true
  })

  const filterableColumns = useMemo(() => ({
    status: {
      title: "Status",
      options: Object.values(LeadStatus).map(status => ({
        label: status.toLowerCase().replace('_', ' '),
        value: status
      }))
    },
    priority: {
      title: "CompanyTaskPriority",
      options: Object.values(CompanyTaskPriority).map(priority => ({
        label: priority.toLowerCase(),
        value: priority
      }))
    }
  }), [])

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Leads</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track your assigned leads
          </p>
        </div>
        <Button onClick={() => router.push(employeePath('/employee/leads/new'))}>
          <Plus className="h-4 w-4 mr-2" />
          Add Lead
        </Button>
      </div>

      <DataTable 
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        searchableColumn="title"
        filterableColumns={filterableColumns}
        onFiltersChange={setFilters}
      />
    </div>
  )
}
