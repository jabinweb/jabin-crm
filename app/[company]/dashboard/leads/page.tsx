'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { columns } from './columns'
import { DataTable } from '@/components/table/data-table'
import { LeadStatus, Priority } from '@prisma/client'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'

type FilterState = {
  [key: string]: string[]
}

export default function LeadsPage() {
  const router = useRouter()
  const params = useParams<{ company: string }>()
  const [filters, setFilters] = useState<FilterState>({
    status: [],
    priority: []
  })

  const { data, isLoading } = useQuery({
    queryKey: ['leads', params.company, filters],
    queryFn: async () => {
      const queryString = new URLSearchParams()
      filters.status.forEach(status => queryString.append('status', status))
      filters.priority.forEach(priority => queryString.append('priority', priority))

      const response = await fetch(`/api/leads?${queryString}`, {
        headers: workspaceSlugHeaders(params.company),
      })
      if (!response.ok) throw new Error('Failed to fetch leads')
      return response.json()
    },
    enabled: !!params.company,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000 // Keep data in cache for 5 minutes
  })

  const filterableColumns = {
    status: {
      title: "Status",
      options: Object.values(LeadStatus).map(status => ({
        label: status.toLowerCase().replace('_', ' '),
        value: status
      }))
    },
    priority: {
      title: "Priority",
      options: Object.values(Priority).map(priority => ({
        label: priority.toLowerCase(),
        value: priority
      }))
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Manage leads and track their progress
          </p>
        </div>
        <Button onClick={() => router.push(`/${params.company}/dashboard/leads/new`)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Lead
        </Button>
      </div>

      <DataTable 
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        searchableColumn="companyName"
        filterableColumns={filterableColumns}
        onFiltersChange={setFilters}
      />
    </div>
  )
}
