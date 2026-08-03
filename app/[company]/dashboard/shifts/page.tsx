'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'

export default function ShiftsPage() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [graceMinutes, setGraceMinutes] = useState('15')

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['hr-shifts'],
    queryFn: async () => {
      const res = await fetch('/api/hr/shifts')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          startTime,
          endTime,
          graceMinutes: Number(graceMinutes),
        }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      toast.success('Shift created')
      setName('')
      void qc.invalidateQueries({ queryKey: ['hr-shifts'] })
    },
    onError: () => toast.error('Could not create shift'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Shifts</h1>
        <p className="text-sm text-muted-foreground">
          Define work shifts for late / early / OT rules.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add shift</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Start</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>End</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Grace (min)</Label>
            <Input value={graceMinutes} onChange={(e) => setGraceMinutes(e.target.value)} />
          </div>
          <Button
            className="sm:col-span-4 w-fit"
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add shift
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shift roster</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {shifts.map(
            (s: {
              id: string
              name: string
              startTime: string
              endTime: string
              graceMinutes: number
              _count?: { assignments: number }
            }) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.startTime} – {s.endTime} · grace {s.graceMinutes}m ·{' '}
                    {s._count?.assignments ?? 0} assigned
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await fetch(`/api/hr/shifts?id=${s.id}`, { method: 'DELETE' })
                    void qc.invalidateQueries({ queryKey: ['hr-shifts'] })
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  )
}
