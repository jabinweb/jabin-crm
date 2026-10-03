'use client'

import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { CardListSkeleton } from '@/components/loading'
import { QueryErrorState, StatusBadge, useDebouncedValue } from '@/components/hr/hr-ui'
import { Search, Users } from 'lucide-react'

type DirEmployee = {
  id: string
  employeeId: string
  name: string
  email: string
  phone: string
  department: string
  jobTitle: string
  status: string
  hrDepartment?: { id: string; name: string } | null
  designation?: { id: string; name: string } | null
  branch?: { id: string; name: string } | null
}

export default function DirectoryPage() {
  const { path } = useWorkspacePaths()
  const [q, setQ] = useState('')
  const debouncedQ = useDebouncedValue(q, 300)
  const [departmentId, setDepartmentId] = useState('all')

  const { data: departments = [] } = useQuery({
    queryKey: ['hr-departments'],
    queryFn: async () => {
      const res = await fetch('/api/hr/departments')
      if (!res.ok) return []
      return res.json()
    },
  })

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedQ.trim()) params.set('q', debouncedQ.trim())
    if (departmentId !== 'all') params.set('departmentId', departmentId)
    const s = params.toString()
    return s ? `?${s}` : ''
  }, [debouncedQ, departmentId])

  const {
    data: employees = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['hr-directory', queryString],
    queryFn: async () => {
      const res = await fetch(`/api/hr/directory${queryString}`)
      if (!res.ok) throw new Error('Failed')
      return (await res.json()) as DirEmployee[]
    },
    placeholderData: keepPreviousData,
  })

  const filtered = queryString.length > 0

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Employee directory</h1>
        <p className="text-sm text-muted-foreground">
          Search active staff by name, email, phone, or employee ID.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label="Search employees"
            placeholder="Name, email, phone or ID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger className="w-full sm:w-[220px]" aria-label="Filter by department">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d: { id: string; name: string }) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <CardListSkeleton rows={6} />
      ) : isError ? (
        <QueryErrorState
          title="Couldn’t load the directory"
          onRetry={() => void refetch()}
          className="rounded-lg border"
        />
      ) : employees.length === 0 ? (
        <div className="rounded-lg border">
          {filtered ? (
            <EmptyState
              icon={Search}
              title="No matching employees"
              description="Try a different name or ID, or clear the filters."
              actionLabel="Clear filters"
              onAction={() => {
                setQ('')
                setDepartmentId('all')
              }}
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No employees yet"
              description="Add employees to see them in the directory."
              actionLabel="Add employee"
              actionHref={path('/dashboard/employees/new')}
            />
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((e) => (
            <Link
              key={e.id}
              href={path(`/dashboard/employees/${e.id}`)}
              className="block min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{e.employeeId}</p>
                    </div>
                    <StatusBadge status={e.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {e.designation?.name || e.jobTitle || '—'}
                  </p>
                  <p className="text-sm">
                    {e.hrDepartment?.name || e.department || '—'}
                    {e.branch?.name ? ` · ${e.branch.name}` : ''}
                  </p>
                  {e.phone ? <p className="text-xs text-muted-foreground">{e.phone}</p> : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
