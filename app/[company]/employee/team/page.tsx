'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
import {
  EssEmptyState,
  EssErrorState,
  EssListSkeleton,
  humanizeStatus,
} from '@/components/employee/mobile/ess-states'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { confirmAction } from '@/lib/confirm-action'
import { format } from 'date-fns'
import { CalendarDays, ChevronRight, Users } from 'lucide-react'
import { toast } from 'sonner'

type Correction = {
  id: string
  reason: string
  date: string
  employee: { name: string; employeeId: string }
}

type TeamMember = {
  id: string
  name: string
  jobTitle: string
  today: {
    checkIn: string | null
    checkOut: string | null
    status: string
  } | null
}

class NotManagerError extends Error {}

function ManagerCorrections() {
  const qc = useQueryClient()
  const { data: rows = [] } = useQuery({
    queryKey: ['manager-corrections'],
    queryFn: async () => {
      const res = await fetch('/api/manager/corrections')
      if (!res.ok) return []
      return res.json() as Promise<Correction[]>
    },
  })

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) => {
      const res = await fetch('/api/manager/corrections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          err.error || (status === 'APPROVED' ? "Couldn't approve the correction" : "Couldn't reject the correction")
        )
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.status === 'APPROVED' ? 'Correction approved' : 'Correction rejected')
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['manager-corrections'] }),
  })

  if (!rows.length) return null
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Attendance corrections to review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => {
          const busy = decide.isPending && decide.variables?.id === r.id
          return (
            <div key={r.id} className="space-y-2 rounded-lg border p-3">
              <p className="break-words text-sm font-medium">
                {r.employee.name} · {format(new Date(r.date), 'EEE, d MMM')}
              </p>
              <p className="break-words text-xs text-muted-foreground">{r.reason}</p>
              <div className="flex gap-2">
                <Button
                  className="flex-1 sm:flex-none"
                  disabled={busy}
                  onClick={() => decide.mutate({ id: r.id, status: 'APPROVED' })}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await confirmAction({
                      title: `Reject ${r.employee.name}'s correction?`,
                      description: `Their attendance for ${format(new Date(r.date), 'd MMM')} stays as recorded.`,
                      confirmLabel: 'Reject',
                      variant: 'destructive',
                    })
                    if (ok) decide.mutate({ id: r.id, status: 'REJECTED' })
                  }}
                >
                  Reject
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function rosterStatus(m: TeamMember) {
  if (m.today?.status) return humanizeStatus(m.today.status)
  return 'Not punched in'
}

export default function ManagerTeamPage() {
  const { employeePath } = useWorkspacePaths()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['manager-team'],
    queryFn: async () => {
      const res = await fetch('/api/manager/team')
      if (res.status === 403) throw new NotManagerError('Not a manager')
      if (!res.ok) throw new Error('Failed to load team')
      return res.json() as Promise<{ team?: TeamMember[] }>
    },
    retry: (count, err) => !(err instanceof NotManagerError) && count < 2,
  })

  if (error instanceof NotManagerError) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
        <EssPageHeader title="My team" subtitle="Manager tools" />
        <EssEmptyState
          icon={Users}
          title="No direct reports"
          description="This page is for managers. Once people report to you, you'll see their attendance and leave requests here."
        />
      </div>
    )
  }

  const team = data?.team ?? []

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
      <EssPageHeader title="My team" subtitle="Today’s attendance and approvals" />
      <Link
        href={employeePath('/employee/team/leave')}
        className="flex min-h-[48px] items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/40"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1">Team leave requests</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>

      <ManagerCorrections />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Today</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <EssListSkeleton rows={3} />
          ) : error ? (
            <EssErrorState message="We couldn't load your team." onRetry={() => void refetch()} />
          ) : team.length === 0 ? (
            <EssEmptyState
              icon={Users}
              title="No team members yet"
              description="People who report to you will appear here with today's attendance."
            />
          ) : (
            team.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  {m.jobTitle ? (
                    <p className="truncate text-xs text-muted-foreground">{m.jobTitle}</p>
                  ) : null}
                  {m.today?.checkIn && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      In {format(new Date(m.today.checkIn), 'h:mm a')}
                      {m.today.checkOut
                        ? ` · Out ${format(new Date(m.today.checkOut), 'h:mm a')}`
                        : ''}
                    </p>
                  )}
                </div>
                <Badge variant={m.today?.checkIn ? 'default' : 'secondary'} className="shrink-0">
                  {rosterStatus(m)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
