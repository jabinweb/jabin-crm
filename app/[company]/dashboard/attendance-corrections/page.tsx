'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function AttendanceCorrectionsAdminPage() {
  const qc = useQueryClient()
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['attendance-corrections-admin'],
    queryFn: async () => {
      const res = await fetch('/api/hr/attendance-corrections?status=PENDING')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      const res = await fetch('/api/hr/attendance-corrections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      toast.success('Updated')
      void qc.invalidateQueries({ queryKey: ['attendance-corrections-admin'] })
    },
    onError: () => toast.error('Action failed'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Attendance regularization</h1>
        <p className="text-sm text-muted-foreground">Approve correction requests.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {rows.map(
            (r: {
              id: string
              reason: string
              date: string
              status: string
              employee: { name: string }
              requestedCheckIn?: string | null
              requestedCheckOut?: string | null
            }) => (
              <div key={r.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">{r.employee.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.date), 'd MMM yyyy')} · {r.reason}
                    </p>
                    <p className="text-xs mt-1">
                      In:{' '}
                      {r.requestedCheckIn
                        ? format(new Date(r.requestedCheckIn), 'HH:mm')
                        : '—'}{' '}
                      · Out:{' '}
                      {r.requestedCheckOut
                        ? format(new Date(r.requestedCheckOut), 'HH:mm')
                        : '—'}
                    </p>
                  </div>
                  <Badge>{r.status}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => act.mutate({ id: r.id, action: 'approve' })}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act.mutate({ id: r.id, action: 'reject' })}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )
          )}
          {!isLoading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No pending requests</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
