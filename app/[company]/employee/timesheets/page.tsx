'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export default function EmployeeTimesheetsPage() {
  const qc = useQueryClient()
  const [hours, setHours] = useState('8')
  const [note, setNote] = useState('')

  const { data: sheets = [] } = useQuery({
    queryKey: ['my-timesheets'],
    queryFn: async () => {
      const res = await fetch('/api/hr/timesheets')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<
        {
          id: string
          weekStart: string
          status: string
          entries: { date: string; hours: number; note?: string | null }[]
        }[]
      >
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().slice(0, 10)
      const res = await fetch('/api/hr/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          entries: [{ date: today, hours: Number(hours), note }],
        }),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: (sheet: { id: string }) => {
      toast.success('Saved')
      void qc.invalidateQueries({ queryKey: ['my-timesheets'] })
      void fetch('/api/hr/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', id: sheet.id }),
      }).then(() => qc.invalidateQueries({ queryKey: ['my-timesheets'] }))
    },
  })

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-xl font-semibold">Timesheets</h1>
        <p className="text-sm text-muted-foreground">Log hours and submit for approval.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Hours</Label>
            <Input value={hours} onChange={(e) => setHours(e.target.value)} type="number" />
          </div>
          <div className="space-y-1">
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save & submit week
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 pt-6">
          {sheets.map((s) => (
            <div key={s.id} className="flex justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">Week of {new Date(s.weekStart).toLocaleDateString()}</p>
                <p className="text-xs text-muted-foreground">
                  {s.entries.reduce((a, e) => a + e.hours, 0)} hrs
                </p>
              </div>
              <Badge>{s.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
