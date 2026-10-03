'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { CardListSkeleton } from '@/components/loading'
import { QueryErrorState, StatusBadge, ensureOk } from '@/components/hr/hr-ui'
import { CalendarClock, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

type Timesheet = {
  id: string
  weekStart: string
  status: string
  employee?: { name: string; employeeId: string } | null
  entries: { date: string; hours: number; note?: string | null }[]
}

export default function TimesheetsAdminPage() {
  const qc = useQueryClient()
  const {
    data: sheets = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['timesheets-admin'],
    queryFn: async () => {
      const res = await fetch('/api/hr/timesheets?admin=1')
      await ensureOk(res, 'Failed to load timesheets')
      return res.json() as Promise<Timesheet[]>
    },
  })

  const act = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) => {
      const res = await fetch('/api/hr/timesheets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await ensureOk(res, 'Could not update the timesheet')
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === 'APPROVED' ? 'Timesheet approved' : 'Timesheet rejected')
      void qc.invalidateQueries({ queryKey: ['timesheets-admin'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Timesheets</h1>
        <p className="text-sm text-muted-foreground">
          Review submitted weekly timesheets across the company.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <CardListSkeleton rows={3} />
          ) : isError ? (
            <QueryErrorState title="Couldn’t load timesheets" onRetry={() => void refetch()} />
          ) : sheets.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No timesheets submitted yet"
              description="Weekly timesheets employees submit from their portal will appear here for review."
            />
          ) : (
            sheets.map((s) => {
              const total = s.entries.reduce((a, e) => a + e.hours, 0)
              const busy = act.isPending && act.variables?.id === s.id
              return (
                <div
                  key={s.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">
                      {s.employee?.name || 'Former employee'}
                      {s.employee?.employeeId && (
                        <span className="text-xs text-muted-foreground"> ({s.employee.employeeId})</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Week of {format(new Date(s.weekStart), 'd MMM yyyy')} · {total} hrs
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={s.status} />
                    {s.status === 'SUBMITTED' && (
                      <>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => act.mutate({ id: s.id, status: 'REJECTED' })}
                        >
                          Reject
                        </Button>
                        <Button disabled={busy} onClick={() => act.mutate({ id: s.id, status: 'APPROVED' })}>
                          {busy && act.variables?.status === 'APPROVED' && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Approve
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
