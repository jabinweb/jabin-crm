'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { CardListSkeleton } from '@/components/loading'
import { QueryErrorState, StatusBadge, ensureOk } from '@/components/hr/hr-ui'
import { confirmAction } from '@/lib/confirm-action'
import { DoorOpen, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

type ExitRequest = {
  id: string
  status: string
  reason: string
  lastWorkingDay: string
  clearance: { item: string; done: boolean }[]
  employee: { name: string }
}

type ExitAction = { id: string; action: 'toggle_clearance'; index: number } | { id: string; action: 'complete' }

export default function ExitAdminPage() {
  const qc = useQueryClient()
  const {
    data: rows = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['hr-exit'],
    queryFn: async () => {
      const res = await fetch('/api/hr/exit?admin=1')
      await ensureOk(res, 'Failed to load exit requests')
      return (await res.json()) as ExitRequest[]
    },
  })

  const update = useMutation({
    mutationFn: async (body: ExitAction) => {
      const res = await fetch('/api/hr/exit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await ensureOk(res, 'Could not update the exit request')
    },
    onSuccess: (_d, v) => {
      if (v.action === 'complete') toast.success('Exit completed')
      void qc.invalidateQueries({ queryKey: ['hr-exit'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Exit management</h1>
        <p className="text-sm text-muted-foreground">
          Track clearance checklists and close out offboarding.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exit requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <CardListSkeleton rows={3} />
          ) : isError ? (
            <QueryErrorState title="Couldn’t load exit requests" onRetry={() => void refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={DoorOpen}
              title="No exit requests"
              description="Resignations submitted from the employee portal will appear here with their clearance checklist."
            />
          ) : (
            rows.map((r) => {
              const busy = update.isPending && update.variables?.id === r.id
              const clearance = r.clearance || []
              const doneCount = clearance.filter((c) => c.done).length
              return (
                <div key={r.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.employee.name}</p>
                      <p className="break-words text-xs text-muted-foreground">
                        Last working day {format(new Date(r.lastWorkingDay), 'd MMM yyyy')}
                        {r.reason ? ` · ${r.reason}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={r.status} className="self-start" />
                  </div>
                  {clearance.length > 0 && (
                    <fieldset className="space-y-1" disabled={busy || r.status === 'COMPLETED'}>
                      <legend className="mb-1 text-xs font-medium text-muted-foreground">
                        Clearance {doneCount}/{clearance.length}
                      </legend>
                      {clearance.map((c, index) => (
                        <label
                          key={index}
                          className="flex min-h-[2.5rem] cursor-pointer items-center gap-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={c.done}
                            onChange={() =>
                              update.mutate({ id: r.id, action: 'toggle_clearance', index })
                            }
                          />
                          <span className={c.done ? 'text-muted-foreground line-through' : undefined}>
                            {c.item}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                  {r.status !== 'COMPLETED' && (
                    <Button
                      disabled={busy}
                      onClick={async () => {
                        const pending = clearance.length - doneCount
                        const ok = await confirmAction({
                          title: `Complete exit for ${r.employee.name}?`,
                          description:
                            pending > 0
                              ? `${pending} clearance item${pending === 1 ? ' is' : 's are'} still open. Completing closes this exit request.`
                              : 'This closes the exit request.',
                          confirmLabel: 'Mark completed',
                        })
                        if (ok) update.mutate({ id: r.id, action: 'complete' })
                      }}
                    >
                      {busy && update.variables?.action === 'complete' && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Mark completed
                    </Button>
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
