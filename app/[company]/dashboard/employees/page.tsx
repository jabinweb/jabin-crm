'use client'
import "@/types/auth"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { UserPlus, Upload } from 'lucide-react'
import { toast } from "@/hooks/use-toast"
import { columns, type Employee } from "./columns"
import { DataTable } from "@/components/table/data-table"
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'

interface Metadata {
  departments: { label: string; value: string }[];
  statuses: { label: string; value: string }[];
  employmentTypes: { label: string; value: string }[];
}

export default function EmployeesPage() {
  const params = useParams<{ company: string }>()
  const companySlug = params.company

  const [employees, setEmployees] = useState<Employee[]>([])
  const [filterOptions, setFilterOptions] = useState<Metadata | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const tenantHeaders = useMemo(
    () => (companySlug ? workspaceSlugHeaders(companySlug) : {}),
    [companySlug]
  )

  const fetchEmployees = useCallback(async (filters?: { department?: string[]; status?: string[] }) => {
    if (!companySlug) return []

    const sp = new URLSearchParams()
    filters?.department?.forEach(dept => sp.append('department', dept))
    filters?.status?.forEach(status => sp.append('status', status))

    const response = await fetch(`/api/employees?${sp}`, { headers: { ...tenantHeaders } })
    const data = await response.json()

    if (!response.ok) throw new Error(data.error)
    return data
  }, [companySlug, tenantHeaders])

  const fetchMetadata = useCallback(async () => {
    if (!companySlug) return null

    const cacheKey = `employeeMetadata:${companySlug}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    const response = await fetch('/api/employees/metadata', { headers: { ...tenantHeaders } })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)

    sessionStorage.setItem(cacheKey, JSON.stringify(data))
    return data
  }, [companySlug, tenantHeaders])

  useEffect(() => {
    if (!companySlug) return

    let mounted = true
    const loadInitialData = async () => {
      try {
        setIsLoading(true)
        const [employeesData, metadataData] = await Promise.all([
          fetchEmployees({}),
          fetchMetadata()
        ])

        if (!mounted) return

        setEmployees(employeesData)
        if (metadataData) setFilterOptions(metadataData)
      } catch (error) {
        if (mounted) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to load employees"
          })
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    loadInitialData()
    return () => { mounted = false }
  }, [companySlug, fetchEmployees, fetchMetadata])

  const handleFiltersChange = useCallback(async (filters: {
    department?: string[]
    status?: string[]
  }) => {
    try {
      setIsLoading(true)
      const data = await fetchEmployees(filters)
      setEmployees(data)
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to filter employees"
      })
    } finally {
      setIsLoading(false)
    }
  }, [fetchEmployees])

  if (!companySlug) {
    return <div className="p-6">Invalid company.</div>
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Employees</h1>
        <div className="flex gap-2">
          <Button variant="outline" type="button">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button asChild>
            <Link href={`/${companySlug}/dashboard/employees/new`} className="inline-flex items-center">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Employee
            </Link>
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={employees}
        isLoading={isLoading}
        searchableColumn="name"
        filterableColumns={{
          department: {
            title: "Department",
            options: filterOptions?.departments || []
          },
          status: {
            title: "Status",
            options: filterOptions?.statuses || []
          }
        }}
        onFiltersChange={handleFiltersChange}
      />
    </div>
  )
}
