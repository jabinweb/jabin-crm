'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function ManagerTeamLeavePage() {
  const queryClient = useQueryClient()
  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ['manager-leave'],
    queryFn: async () => {
      const res = await fetch('/api/manager/leave')
      if (res.status === 403) throw new Error('Not a manager')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  const actionMutation = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string
      action: 'approve' | 'reject'
    }) => {
      const res = await fetch('/api/manager/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed')
      }
    },
    onSuccess: () => {
      toast.success('Updated')
      void queryClient.invalidateQueries({ queryKey: ['manager-leave'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (error) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <EssPageHeader title="Team leave" subtitle="Pending approvals" />
        <p className="text-sm text-muted-foreground text-center py-8">
          You do not have permission to manage leave.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <EssPageHeader title="Team leave" subtitle="Pending approvals" />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pending</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {requests.map(
            (r: {
              id: string
              startDate: string
              endDate: string
              days: number
              reason: string
              employee: { name: string }
              policy?: { name: string } | null
              type: string
            }) => (
              <div key={r.id} className="rounded-xl border p-3 space-y-2">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{r.employee.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.policy?.name || r.type} · {r.days} day(s)
                    </p>
                    <p className="text-xs mt-1">
                      {format(new Date(r.startDate), 'd MMM')} –{' '}
                      {format(new Date(r.endDate), 'd MMM yyyy')}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{r.reason}</p>
                  </div>
                  <Badge variant="secondary">PENDING</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={actionMutation.isPending}
                    onClick={() =>
                      actionMutation.mutate({ id: r.id, action: 'approve' })
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={actionMutation.isPending}
                    onClick={() =>
                      actionMutation.mutate({ id: r.id, action: 'reject' })
                    }
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )
          )}
          {!isLoading && requests.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No pending leave requests
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
