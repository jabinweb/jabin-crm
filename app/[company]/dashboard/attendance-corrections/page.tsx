'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { CardListSkeleton } from '@/components/loading'
import { QueryErrorState, StatusBadge, ensureOk } from '@/components/hr/hr-ui'
import { CalendarCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

type Correction = {
  id: string
  reason: string
  date: string
  status: string
  employee: { name: string }
  requestedCheckIn?: string | null
  requestedCheckOut?: string | null
}

export default function AttendanceCorrectionsAdminPage() {
  const qc = useQueryClient()
  const {
    data: rows = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['attendance-corrections-admin'],
    queryFn: async () => {
      const res = await fetch('/api/hr/attendance-corrections?status=PENDING&admin=1')
      await ensureOk(res, 'Failed to load requests')
      return (await res.json()) as Correction[]
    },
  })

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      const res = await fetch('/api/hr/attendance-corrections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      await ensureOk(res, 'Action failed')
    },
    onSuccess: (_d, v) => {
      toast.success(v.action === 'approve' ? 'Correction approved' : 'Correction rejected')
      void qc.invalidateQueries({ queryKey: ['attendance-corrections-admin'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Attendance regularization</h1>
        <p className="text-sm text-muted-foreground">
          Review check-in and check-out corrections requested by employees.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <CardListSkeleton rows={3} />
          ) : isError ? (
            <QueryErrorState title="Couldn’t load requests" onRetry={() => void refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="No pending requests"
              description="Corrections employees submit from their attendance page will appear here."
            />
          ) : (
            rows.map((r) => {
              const busy = act.isPending && act.variables?.id === r.id
              return (
                <div key={r.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.employee.name}</p>
                      <p className="break-words text-xs text-muted-foreground">
                        {format(new Date(r.date), 'd MMM yyyy')} · {r.reason}
                      </p>
                      <p className="mt-1 text-xs">
                        Check-in{' '}
                        {r.requestedCheckIn ? format(new Date(r.requestedCheckIn), 'HH:mm') : '—'} · Check-out{' '}
                        {r.requestedCheckOut ? format(new Date(r.requestedCheckOut), 'HH:mm') : '—'}
                      </p>
                    </div>
                    <StatusBadge status={r.status} className="self-start" />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => act.mutate({ id: r.id, action: 'reject' })}
                    >
                      Reject
                    </Button>
                    <Button disabled={busy} onClick={() => act.mutate({ id: r.id, action: 'approve' })}>
                      {busy && act.variables?.action === 'approve' && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Approve
                    </Button>
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
