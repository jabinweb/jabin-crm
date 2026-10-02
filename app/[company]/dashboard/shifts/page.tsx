'use client'

import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { CardListSkeleton } from '@/components/loading'
import { QueryErrorState, ensureOk } from '@/components/hr/hr-ui'
import { confirmAction } from '@/lib/confirm-action'
import { toast } from 'sonner'
import { Clock, Loader2, Trash2 } from 'lucide-react'

type Shift = {
  id: string
  name: string
  startTime: string
  endTime: string
  graceMinutes: number
  _count?: { assignments: number }
}

export default function ShiftsPage() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [graceMinutes, setGraceMinutes] = useState('15')

  const {
    data: shifts = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['hr-shifts'],
    queryFn: async () => {
      const res = await fetch('/api/hr/shifts')
      await ensureOk(res, 'Failed to load shifts')
      return (await res.json()) as Shift[]
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          startTime,
          endTime,
          graceMinutes: Number(graceMinutes),
        }),
      })
      await ensureOk(res, 'Could not create shift')
    },
    onSuccess: () => {
      toast.success(`Shift “${name.trim()}” created`)
      setName('')
      void qc.invalidateQueries({ queryKey: ['hr-shifts'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/hr/shifts?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      await ensureOk(res, 'Could not delete shift')
    },
    onSuccess: () => {
      toast.success('Shift deleted')
      void qc.invalidateQueries({ queryKey: ['hr-shifts'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const graceNum = Number(graceMinutes)
  const graceValid = graceMinutes.trim() !== '' && Number.isInteger(graceNum) && graceNum >= 0
  const canCreate = name.trim() && startTime && endTime && graceValid && !create.isPending

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (canCreate) create.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Shifts</h1>
        <p className="text-sm text-muted-foreground">
          Working hours used to flag late arrivals, early exits and overtime.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add shift</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2 space-y-2 sm:col-span-1">
                <Label htmlFor="shift-name">Name</Label>
                <Input
                  id="shift-name"
                  placeholder="General shift"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shift-start">Starts</Label>
                <Input
                  id="shift-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shift-end">Ends</Label>
                <Input
                  id="shift-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-2 sm:col-span-1">
                <Label htmlFor="shift-grace">Grace period (minutes)</Label>
                <Input
                  id="shift-grace"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={graceMinutes}
                  onChange={(e) => setGraceMinutes(e.target.value)}
                  aria-invalid={!graceValid || undefined}
                />
                {!graceValid && (
                  <p className="text-xs text-destructive">Enter whole minutes, 0 or more.</p>
                )}
              </div>
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={!canCreate}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add shift
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shifts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <CardListSkeleton rows={3} />
          ) : isError ? (
            <QueryErrorState title="Couldn’t load shifts" onRetry={() => void refetch()} />
          ) : shifts.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No shifts yet"
              description="Add a shift above so attendance can mark late arrivals and overtime."
            />
          ) : (
            shifts.map((s) => {
              const assigned = s._count?.assignments ?? 0
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {s.startTime} – {s.endTime} · {s.graceMinutes} min grace · {assigned}{' '}
                      {assigned === 1 ? 'employee' : 'employees'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    aria-label={`Delete ${s.name}`}
                    disabled={remove.isPending && remove.variables === s.id}
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: `Delete ${s.name}?`,
                        description:
                          assigned > 0
                            ? `${assigned} employee${assigned === 1 ? ' is' : 's are'} assigned to this shift.`
                            : 'This shift will be removed.',
                        confirmLabel: 'Delete',
                        variant: 'destructive',
                      })
                      if (ok) remove.mutate(s.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
