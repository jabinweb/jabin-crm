'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { CardListSkeleton } from '@/components/loading'

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
    if (q.trim()) params.set('q', q.trim())
    if (departmentId !== 'all') params.set('departmentId', departmentId)
    const s = params.toString()
    return s ? `?${s}` : ''
  }, [q, departmentId])

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['hr-directory', queryString],
    queryFn: async () => {
      const res = await fetch(`/api/hr/directory${queryString}`)
      if (!res.ok) throw new Error('Failed')
      return (await res.json()) as DirEmployee[]
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Employee directory</h1>
        <p className="text-sm text-muted-foreground">
          Search active staff by name, email, phone, or employee ID.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:max-w-sm"
        />
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger className="sm:w-[220px]">
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
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((e) => (
            <Link key={e.id} href={path(`/dashboard/employees/${e.id}`)}>
              <Card className="hover:bg-muted/40 transition-colors h-full">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{e.employeeId}</p>
                    </div>
                    <Badge variant="secondary">{e.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {e.designation?.name || e.jobTitle}
                  </p>
                  <p className="text-sm">
                    {e.hrDepartment?.name || e.department}
                    {e.branch?.name ? ` · ${e.branch.name}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">{e.phone}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {employees.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full py-8 text-center">
              No employees found
            </p>
          )}
        </div>
      )}
    </div>
  )
}
