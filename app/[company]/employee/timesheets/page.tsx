'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Timer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
import {
  EssEmptyState,
  EssErrorState,
  EssListSkeleton,
  StatusBadge,
} from '@/components/employee/mobile/ess-states'

type ProjectOption = { id: string; name: string }

type Timesheet = {
  id: string
  weekStart: string
  status: string
  entries: {
    date: string
    hours: number
    note?: string | null
    projectId?: string | null
  }[]
}

export default function EmployeeTimesheetsPage() {
  const qc = useQueryClient()
  const [hours, setHours] = useState('8')
  const [note, setNote] = useState('')
  const [projectId, setProjectId] = useState('')

  const {
    data: sheets = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['my-timesheets'],
    queryFn: async () => {
      const res = await fetch('/api/hr/timesheets')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<Timesheet[]>
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

  const hoursNum = Number(hours)
  const hoursInvalid = hours === '' || Number.isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 24

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
              hours: hoursNum,
              note,
              projectId: projectId || undefined,
              billable: true,
            },
          ],
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Couldn't save your timesheet")
      }
      return res.json()
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't save your timesheet"),
    onSuccess: (sheet: { id: string }) => {
      void qc.invalidateQueries({ queryKey: ['my-timesheets'] })
      void fetch('/api/hr/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', id: sheet.id }),
      })
        .then((res) => {
          if (res.ok) toast.success("Today's hours saved and your week submitted for approval")
          else toast.warning("Hours saved, but the week couldn't be submitted. Try saving again.")
        })
        .catch(() =>
          toast.warning("Hours saved, but the week couldn't be submitted. Try saving again.")
        )
        .finally(() => qc.invalidateQueries({ queryKey: ['my-timesheets'] }))
    },
  })

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
      <EssPageHeader
        title="Timesheets"
        subtitle="Log today's hours against a project and submit your week for approval."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today · {format(new Date(), 'EEE, d MMM')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!hoursInvalid && !save.isPending) save.mutate()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="ts-project">Project</Label>
              <select
                id="ts-project"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
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
            <div className="space-y-1.5">
              <Label htmlFor="ts-hours">Hours</Label>
              <Input
                id="ts-hours"
                type="number"
                inputMode="decimal"
                min={0.25}
                max={24}
                step={0.25}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
              {hoursInvalid ? (
                <p className="text-xs text-destructive">Enter between 0.25 and 24 hours.</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ts-note">What did you work on? (optional)</Label>
              <Input id="ts-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={hoursInvalid || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save & submit week'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My weeks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <EssListSkeleton rows={2} />
          ) : isError ? (
            <EssErrorState
              message="We couldn't load your timesheets."
              onRetry={() => void refetch()}
            />
          ) : sheets.length === 0 ? (
            <EssEmptyState
              icon={Timer}
              title="No timesheets yet"
              description="Log today's hours above. Each week you submit shows up here with its approval status."
            />
          ) : (
            sheets.map((s) => {
              const total = s.entries.reduce((a, e) => a + Number(e.hours || 0), 0)
              const projectEntries = s.entries.filter((e) => e.projectId).length
              return (
                <div key={s.id} className="flex justify-between gap-2 rounded-lg border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      Week of {format(new Date(s.weekStart.slice(0, 10) + 'T00:00:00'), 'd MMM yyyy')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {total} {total === 1 ? 'hour' : 'hours'}
                      {projectEntries
                        ? ` · ${projectEntries} project ${projectEntries === 1 ? 'entry' : 'entries'}`
                        : ''}
                    </p>
                  </div>
                  <StatusBadge status={s.status} className="self-start" />
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
