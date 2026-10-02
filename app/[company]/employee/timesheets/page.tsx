'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type ProjectOption = { id: string; name: string }

export default function EmployeeTimesheetsPage() {
  const qc = useQueryClient()
  const [hours, setHours] = useState('8')
  const [note, setNote] = useState('')
  const [projectId, setProjectId] = useState('')

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
          entries: {
            date: string
            hours: number
            note?: string | null
            projectId?: string | null
          }[]
        }[]
      >
    },
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['timesheet-projects'],
    queryFn: async () => {
      const res = await fetch('/api/employee/projects')
      if (!res.ok) return []
      const json = await res.json()
      return (Array.isArray(json) ? json : []) as ProjectOption[]
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      // Local calendar date (toISOString() is UTC and gives "yesterday" early morning in IST)
      const now = new Date()
      const ymd = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const today = ymd(now)
      const monday = new Date(now)
      monday.setDate(now.getDate() + (now.getDay() === 0 ? -6 : 1 - now.getDay()))
      // The API replaces the whole week's entries, so keep the other days already logged.
      const thisWeek = sheets.find((s) => s.weekStart.slice(0, 10) === ymd(monday))
      const otherDays = (thisWeek?.entries ?? [])
        .filter((e) => e.date.slice(0, 10) !== today)
        .map((e) => ({
          date: e.date.slice(0, 10),
          hours: e.hours,
          note: e.note ?? undefined,
          projectId: e.projectId ?? undefined,
        }))
      const res = await fetch('/api/hr/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          weekStart: ymd(monday),
          entries: [
            ...otherDays,
            {
              date: today,
              hours: Number(hours),
              note,
              projectId: projectId || undefined,
              billable: true,
            },
          ],
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed')
      }
      return res.json()
    },
    onError: (e: Error) => toast.error(e.message || 'Could not save timesheet'),
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
        <p className="text-sm text-muted-foreground">
          Log hours against delivery projects and submit for approval.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Project</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">No project / internal</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
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
                  {s.entries.some((e) => e.projectId)
                    ? ` · ${s.entries.filter((e) => e.projectId).length} project entries`
                    : ''}
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
