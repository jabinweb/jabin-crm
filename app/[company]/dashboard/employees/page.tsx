'use client'
import '@/types/auth'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { DashboardLink } from '@/components/navigation/dashboard-link'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { UserPlus, Upload, Search } from 'lucide-react'
import {
  columns,
  employeeStatusClass,
  type Employee,
} from '@/components/employees/employees-columns'
import { QueryErrorState, humanizeEnum } from '@/components/hr/hr-ui'
import { CardListSkeleton } from '@/components/loading'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/user-avatar'
import { cn } from '@/lib/utils'
import { DataTable } from '@/components/table/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'

interface Metadata {
  departments: { label: string; value: string }[]
  statuses: { label: string; value: string }[]
  employmentTypes: { label: string; value: string }[]
}

export default function EmployeesPage() {
  const params = useParams<{ company: string }>()
  const { slug, path } = useWorkspacePaths()
  const companySlug = slug ?? params.company

  const [employees, setEmployees] = useState<Employee[]>([])
  const [filterOptions, setFilterOptions] = useState<Metadata | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mobileQuery, setMobileQuery] = useState('')
  const tenantHeaders = useMemo(
    () => (companySlug ? workspaceSlugHeaders(companySlug) : {}),
    [companySlug]
  )

  const fetchEmployees = useCallback(
    async (filters?: { department?: string[]; status?: string[] }) => {
      if (!companySlug) return []

      const sp = new URLSearchParams()
      filters?.department?.forEach((dept) => sp.append('department', dept))
      filters?.status?.forEach((status) => sp.append('status', status))

      const response = await fetch(`/api/employees?${sp}`, {
        headers: { ...tenantHeaders },
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Failed to load employees')
      return Array.isArray(data) ? data : []
    },
    [companySlug, tenantHeaders]
  )

  const fetchMetadata = useCallback(async () => {
    if (!companySlug) return null

    const cacheKey = `employeeMetadata:${companySlug}`
    try {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) return JSON.parse(cached) as Metadata
    } catch {
      // ignore bad cache
    }

    const response = await fetch('/api/employees/metadata', {
      headers: { ...tenantHeaders },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to load metadata')

    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(data))
    } catch {
      // ignore quota
    }
    return data as Metadata
  }, [companySlug, tenantHeaders])

  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!companySlug) {
      setIsLoading(false)
      return
    }

    let mounted = true
    const loadInitialData = async () => {
      try {
        setIsLoading(true)
        setLoadFailed(false)
        const [employeesData, metadataData] = await Promise.all([
          fetchEmployees({}),
          fetchMetadata().catch(() => null),
        ])

        if (!mounted) return

        setEmployees(employeesData)
        if (metadataData) setFilterOptions(metadataData)
      } catch {
        if (mounted) setLoadFailed(true)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    loadInitialData()
    return () => {
      mounted = false
    }
  }, [companySlug, fetchEmployees, fetchMetadata, reloadKey])

  const mobileEmployees = useMemo(() => {
    const q = mobileQuery.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((e) => (e.name ?? '').toLowerCase().includes(q))
  }, [employees, mobileQuery])

  if (!companySlug) {
    return (
      <EmptyState
        title="Workspace not found"
        description="Open Employees from your workspace dashboard."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            Everyone in your workspace, with their department and status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <DashboardLink
              href="/dashboard/settings/migration"
              className="inline-flex items-center"
              title="Import employees from CSV via Data migration"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </DashboardLink>
          </Button>
          <Button asChild>
            <DashboardLink href="/dashboard/employees/new" className="inline-flex items-center">
              <UserPlus className="h-4 w-4 mr-2" />
              Add employee
            </DashboardLink>
          </Button>
        </div>
      </div>

      {loadFailed ? (
        <QueryErrorState
          title="Couldn’t load employees"
          onRetry={() => setReloadKey((k) => k + 1)}
          className="rounded-lg border"
        />
      ) : !isLoading && employees.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No employees yet"
          description="Add your first employee, or import a CSV of your team."
          actionLabel="Add employee"
          actionHref={path('/dashboard/employees/new')}
          className="rounded-lg border"
        />
      ) : (
        <>
        <div className="space-y-3 md:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              aria-label="Search employees by name"
              placeholder="Search name…"
              value={mobileQuery}
              onChange={(e) => setMobileQuery(e.target.value)}
              className="w-full pl-9"
            />
          </div>
          {isLoading && employees.length === 0 ? (
            <CardListSkeleton rows={6} />
          ) : mobileEmployees.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches"
              description={`Nobody named “${mobileQuery.trim()}”.`}
              actionLabel="Clear search"
              onAction={() => setMobileQuery('')}
              className="rounded-lg border py-8"
            />
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {mobileEmployees.map((employee) => (
                <li key={employee.id}>
                  <Link
                    href={path(`/dashboard/employees/${employee.id}`)}
                    className="flex items-center gap-3 p-3 active:bg-muted/60"
                  >
                    <UserAvatar person={employee} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{employee.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[employee.department, employee.email].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {employee.status ? (
                      <Badge className={cn('shrink-0', employeeStatusClass(employee.status))}>
                        {humanizeEnum(employee.status)}
                      </Badge>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="hidden min-w-0 md:block">
        <DataTable
          columns={columns}
          data={employees}
          isLoading={isLoading}
          searchableColumn="name"
          filterableColumns={{
            department: {
              title: 'Department',
              options: filterOptions?.departments || [],
            },
            status: {
              title: 'Status',
              options: filterOptions?.statuses || [],
            },
          }}
        />
        </div>
        </>
      )}
    </div>
  )
}
