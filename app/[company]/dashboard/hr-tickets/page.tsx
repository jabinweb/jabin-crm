'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { CardListSkeleton } from '@/components/loading'
import { QueryErrorState, StatusBadge, ensureOk, humanizeEnum } from '@/components/hr/hr-ui'
import { LifeBuoy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Ticket = {
  id: string
  subject: string
  category: string
  status: string
  body: string
  employee: { name: string; employeeId: string }
}

export default function HrTicketsAdminPage() {
  const qc = useQueryClient()
  const {
    data: tickets = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['hr-tickets-admin'],
    queryFn: async () => {
      const res = await fetch('/api/hr/tickets?admin=1')
      await ensureOk(res, 'Failed to load tickets')
      return res.json() as Promise<Ticket[]>
    },
  })

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'IN_PROGRESS' | 'RESOLVED' }) => {
      const res = await fetch('/api/hr/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await ensureOk(res, 'Could not update the ticket')
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === 'RESOLVED' ? 'Ticket resolved' : 'Marked in progress')
      void qc.invalidateQueries({ queryKey: ['hr-tickets-admin'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">HR tickets</h1>
        <p className="text-sm text-muted-foreground">
          Questions and requests employees raise from their portal.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-3 pt-4 sm:pt-6">
          {isLoading ? (
            <CardListSkeleton rows={4} />
          ) : isError ? (
            <QueryErrorState title="Couldn’t load tickets" onRetry={() => void refetch()} />
          ) : tickets.length === 0 ? (
            <EmptyState
              icon={LifeBuoy}
              title="Inbox is clear"
              description="When an employee raises an HR ticket it will show up here."
            />
          ) : (
            tickets.map((t) => {
              const busy = setStatus.isPending && setStatus.variables?.id === t.id
              const closed = t.status === 'RESOLVED' || t.status === 'CLOSED'
              return (
                <div key={t.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-medium">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.employee.name} · {humanizeEnum(t.category)}
                      </p>
                    </div>
                    <StatusBadge status={t.status} className="self-start" />
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{t.body}</p>
                  {!closed && (
                    <div className="flex flex-wrap gap-2">
                      {t.status !== 'IN_PROGRESS' && (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => setStatus.mutate({ id: t.id, status: 'IN_PROGRESS' })}
                        >
                          Mark in progress
                        </Button>
                      )}
                      <Button
                        disabled={busy}
                        onClick={() => setStatus.mutate({ id: t.id, status: 'RESOLVED' })}
                      >
                        {busy && setStatus.variables?.status === 'RESOLVED' && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Resolve
                      </Button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
