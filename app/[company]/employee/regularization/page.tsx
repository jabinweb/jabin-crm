'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function RegularizationPage() {
  const qc = useQueryClient()
  const [date, setDate] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [reason, setReason] = useState('')

  const { data: rows = [] } = useQuery({
    queryKey: ['my-corrections'],
    queryFn: async () => {
      const res = await fetch('/api/hr/attendance-corrections')
      if (!res.ok) return []
      return res.json()
    },
  })

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/attendance-corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          reason,
          requestedCheckIn: checkIn ? `${date}T${checkIn}:00` : null,
          requestedCheckOut: checkOut ? `${date}T${checkOut}:00` : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed')
      }
    },
    onSuccess: () => {
      toast.success('Request submitted')
      setReason('')
      void qc.invalidateQueries({ queryKey: ['my-corrections'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <EssPageHeader title="Regularization" subtitle="Request attendance correction" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Check-in</Label>
              <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Check-out</Label>
              <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button
            className="w-full"
            disabled={!date || !reason || submit.isPending}
            onClick={() => submit.mutate()}
          >
            Submit
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map((r: { id: string; date: string; status: string; reason: string }) => (
            <div key={r.id} className="flex justify-between rounded-lg border px-3 py-2">
              <div>
                <p className="text-sm font-medium">
                  {format(new Date(r.date), 'd MMM yyyy')}
                </p>
                <p className="text-xs text-muted-foreground">{r.reason}</p>
              </div>
              <Badge variant="secondary">{r.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
