'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { format } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { toast } from 'sonner'

function ManagerCorrections() {
  const qc = useQueryClient()
  const { data: rows = [] } = useQuery({
    queryKey: ['manager-corrections'],
    queryFn: async () => {
      const res = await fetch('/api/manager/corrections')
      if (!res.ok) return []
      return res.json() as Promise<
        {
          id: string
          reason: string
          date: string
          employee: { name: string; employeeId: string }
        }[]
      >
    },
  })
  if (!rows.length) return null
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pending corrections</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border p-3 space-y-2">
            <p className="text-sm font-medium">
              {r.employee.name} · {format(new Date(r.date), 'd MMM')}
            </p>
            <p className="text-xs text-muted-foreground">{r.reason}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  await fetch('/api/manager/corrections', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: r.id, status: 'APPROVED' }),
                  })
                  toast.success('Approved')
                  void qc.invalidateQueries({ queryKey: ['manager-corrections'] })
                }}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await fetch('/api/manager/corrections', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: r.id, status: 'REJECTED' }),
                  })
                  void qc.invalidateQueries({ queryKey: ['manager-corrections'] })
                }}
              >
                Reject
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function ManagerTeamPage() {
  const { employeePath } = useWorkspacePaths()
  const { data, isLoading, error } = useQuery({
    queryKey: ['manager-team'],
    queryFn: async () => {
      const res = await fetch('/api/manager/team')
      if (res.status === 403) throw new Error('Not a manager')
      if (!res.ok) throw new Error('Failed to load team')
      return res.json()
    },
  })

  if (error) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <EssPageHeader title="My team" subtitle="Manager tools" />
        <p className="text-sm text-muted-foreground text-center py-8">
          You do not have direct reports assigned.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <EssPageHeader title="My team" subtitle="Today’s attendance" />
      <Button asChild variant="outline" className="w-full">
        <Link href={employeePath('/employee/team/leave')}>
          <CalendarDays className="mr-2 h-4 w-4" />
          Team leave requests
        </Link>
      </Button>

      <ManagerCorrections />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Roster</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {data?.team?.map(
            (m: {
              id: string
              name: string
              jobTitle: string
              today: {
                checkIn: string | null
                checkOut: string | null
                status: string
              } | null
            }) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.jobTitle}</p>
                  {m.today?.checkIn && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      In {format(new Date(m.today.checkIn), 'HH:mm')}
                      {m.today.checkOut
                        ? ` · Out ${format(new Date(m.today.checkOut), 'HH:mm')}`
                        : ''}
                    </p>
                  )}
                </div>
                <Badge variant={m.today?.checkIn ? 'default' : 'secondary'}>
                  {m.today?.status || 'ABSENT'}
                </Badge>
              </div>
            )
          )}
          {!isLoading && (!data?.team || data.team.length === 0) && (
            <p className="text-sm text-muted-foreground">No team members</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
