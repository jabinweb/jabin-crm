'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { CardListSkeleton } from '@/components/loading'
import { QueryErrorState, StatusBadge, ensureOk } from '@/components/hr/hr-ui'
import { useCurrency } from '@/hooks/use-currency'
import { Loader2, Plane } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

type TravelRequest = {
  id: string
  purpose: string
  fromDate: string
  toDate: string
  estimate: number
  status: string
  employee?: { name: string; employeeId: string } | null
}

export default function TravelAdminPage() {
  const qc = useQueryClient()
  const { formatCurrency } = useCurrency()
  const {
    data: rows = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['travel-admin'],
    queryFn: async () => {
      const res = await fetch('/api/hr/travel?admin=1')
      await ensureOk(res, 'Failed to load travel requests')
      return res.json() as Promise<TravelRequest[]>
    },
  })

  const act = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) => {
      const res = await fetch('/api/hr/travel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await ensureOk(res, 'Could not update the request')
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === 'APPROVED' ? 'Travel approved' : 'Travel rejected')
      void qc.invalidateQueries({ queryKey: ['travel-admin'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Travel requests</h1>
        <p className="text-sm text-muted-foreground">
          Approve or reject employee travel requests.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <CardListSkeleton rows={3} />
          ) : isError ? (
            <QueryErrorState title="Couldn’t load travel requests" onRetry={() => void refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Plane}
              title="No travel requests yet"
              description="Trips employees request from their portal will appear here for approval."
            />
          ) : (
            rows.map((r) => {
              const busy = act.isPending && act.variables?.id === r.id
              return (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">{r.purpose}</p>
                    <p className="text-xs text-muted-foreground">
                      {[r.employee?.name, r.employee?.employeeId].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.fromDate), 'd MMM yyyy')} – {format(new Date(r.toDate), 'd MMM yyyy')}{' '}
                      {/* Employees enter estimates in ₹ on the portal. */}
                      · Estimated {formatCurrency(Number(r.estimate), 'INR')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.status} />
                    {r.status === 'PENDING' && (
                      <>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => act.mutate({ id: r.id, status: 'REJECTED' })}
                        >
                          Reject
                        </Button>
                        <Button disabled={busy} onClick={() => act.mutate({ id: r.id, status: 'APPROVED' })}>
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
