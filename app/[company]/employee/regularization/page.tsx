'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarClock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
import {
  EssEmptyState,
  EssErrorState,
  EssListSkeleton,
  StatusBadge,
} from '@/components/employee/mobile/ess-states'
import { toast } from 'sonner'
import { format } from 'date-fns'

type CorrectionRow = { id: string; date: string; status: string; reason: string }

export default function RegularizationPage() {
  const qc = useQueryClient()
  const [date, setDate] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [reason, setReason] = useState('')
  const today = format(new Date(), 'yyyy-MM-dd')

  const {
    data: rows = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['my-corrections'],
    queryFn: async () => {
      const res = await fetch('/api/hr/attendance-corrections')
      if (!res.ok) throw new Error('Failed to load requests')
      return (await res.json()) as CorrectionRow[]
    },
  })

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/attendance-corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          reason: reason.trim(),
          // Browser-local wall time -> absolute ISO instant (the server runs in UTC)
          requestedCheckIn: checkIn ? new Date(`${date}T${checkIn}:00`).toISOString() : null,
          requestedCheckOut: checkOut ? new Date(`${date}T${checkOut}:00`).toISOString() : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Couldn't submit your request")
      }
    },
    onSuccess: () => {
      toast.success('Correction request sent for approval')
      setDate('')
      setCheckIn('')
      setCheckOut('')
      setReason('')
      void qc.invalidateQueries({ queryKey: ['my-corrections'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const timesInvalid = Boolean(checkIn && checkOut && checkOut <= checkIn)
  const canSubmit = Boolean(date) && reason.trim().length > 0 && !timesInvalid && !submit.isPending

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
      <EssPageHeader
        title="Regularization"
        subtitle="Missed a punch or punched at the wrong time? Ask for a correction."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New request</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (canSubmit) submit.mutate()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="reg-date">Date</Label>
              <Input
                id="reg-date"
                type="date"
                max={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <div className="space-y-2">
                <Label htmlFor="reg-in">Check-in</Label>
                <Input
                  id="reg-in"
                  type="time"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-out">Check-out</Label>
                <Input
                  id="reg-out"
                  type="time"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </div>
            </div>
            {timesInvalid ? (
              <p className="text-xs text-destructive">Check-out must be after check-in.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Leave a time blank if it was recorded correctly.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="reg-reason">Reason</Label>
              <Textarea
                id="reg-reason"
                placeholder="e.g. Forgot to punch out after a client meeting"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {submit.isPending ? 'Submitting…' : 'Submit request'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <EssListSkeleton rows={2} />
          ) : isError ? (
            <EssErrorState
              message="We couldn't load your correction requests."
              onRetry={() => void refetch()}
            />
          ) : rows.length === 0 ? (
            <EssEmptyState
              icon={CalendarClock}
              title="No correction requests"
              description="Requests you send above, and their approval status, appear here."
            />
          ) : (
            rows.map((r) => (
              <div key={r.id} className="flex justify-between gap-2 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{format(new Date(r.date), 'EEE, d MMM yyyy')}</p>
                  <p className="break-words text-xs text-muted-foreground">{r.reason}</p>
                </div>
                <StatusBadge status={r.status} className="self-start" />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
