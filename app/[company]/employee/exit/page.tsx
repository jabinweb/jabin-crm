'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, DoorOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
import {
  EssEmptyState,
  EssErrorState,
  EssListSkeleton,
  StatusBadge,
} from '@/components/employee/mobile/ess-states'
import { confirmAction } from '@/lib/confirm-action'
import { toast } from 'sonner'
import { format } from 'date-fns'

type ExitRow = {
  id: string
  status: string
  lastWorkingDay: string
  clearance: { item: string; done: boolean }[]
}

export default function EmployeeExitPage() {
  const qc = useQueryClient()
  const [lastWorkingDay, setLastWorkingDay] = useState('')
  const [reason, setReason] = useState('')
  const today = format(new Date(), 'yyyy-MM-dd')

  const {
    data: rows = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['my-exit'],
    queryFn: async () => {
      const res = await fetch('/api/hr/exit')
      if (!res.ok) throw new Error('Failed to load exit requests')
      return (await res.json()) as ExitRow[]
    },
  })

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastWorkingDay, reason: reason.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(typeof err.error === 'string' ? err.error : "Couldn't submit your resignation")
      }
    },
    onSuccess: () => {
      toast.success('Resignation submitted to HR')
      setLastWorkingDay('')
      setReason('')
      void qc.invalidateQueries({ queryKey: ['my-exit'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const canSubmit = Boolean(lastWorkingDay) && reason.trim().length > 0 && !submit.isPending

  const onSubmit = async () => {
    if (!canSubmit) return
    const ok = await confirmAction({
      title: 'Submit your resignation?',
      description: `This sends your resignation to HR with ${format(
        new Date(`${lastWorkingDay}T00:00:00`),
        'd MMM yyyy'
      )} as your proposed last working day.`,
      confirmLabel: 'Submit resignation',
      variant: 'destructive',
    })
    if (ok) submit.mutate()
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
      <EssPageHeader title="Exit request" subtitle="Resignation and clearance" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submit resignation</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void onSubmit()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="exit-lwd">Proposed last working day</Label>
              <Input
                id="exit-lwd"
                type="date"
                min={today}
                value={lastWorkingDay}
                onChange={(e) => setLastWorkingDay(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exit-reason">Reason</Label>
              <Textarea
                id="exit-reason"
                placeholder="Share a short reason for leaving"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {submit.isPending ? 'Submitting…' : 'Submit resignation'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <EssListSkeleton rows={1} />
          ) : isError ? (
            <EssErrorState
              message="We couldn't load your exit request."
              onRetry={() => void refetch()}
            />
          ) : rows.length === 0 ? (
            <EssEmptyState
              icon={DoorOpen}
              title="No exit request"
              description="If you submit a resignation, its approval and clearance checklist appear here."
            />
          ) : (
            rows.map((r) => (
              <div key={r.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm">
                    Last working day{' '}
                    <span className="font-medium">
                      {format(new Date(r.lastWorkingDay), 'd MMM yyyy')}
                    </span>
                  </p>
                  <StatusBadge status={r.status} />
                </div>
                {(r.clearance || []).length > 0 ? (
                  <ul className="space-y-1 text-xs text-muted-foreground" aria-label="Clearance checklist">
                    {r.clearance.map((c, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        {c.done ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Done" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 shrink-0" aria-label="Pending" />
                        )}
                        <span className={c.done ? 'line-through' : undefined}>{c.item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
