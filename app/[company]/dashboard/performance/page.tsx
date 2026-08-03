'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export default function PerformanceAdminPage() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [cycleId, setCycleId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [goalTitle, setGoalTitle] = useState('')

  const { data } = useQuery({
    queryKey: ['perf-admin'],
    queryFn: async () => {
      const res = await fetch('/api/hr/performance?admin=1')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{
        cycles: {
          id: string
          name: string
          status: string
          startDate: string
          endDate: string
          _count: { goals: number; reviews: number }
        }[]
      }>
    },
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-dir-perf'],
    queryFn: async () => {
      const res = await fetch('/api/hr/directory')
      if (!res.ok) return []
      return (await res.json()) as { id: string; name: string; employeeId: string }[]
    },
  })

  const createCycle = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_cycle',
          name,
          startDate: start,
          endDate: end,
        }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      toast.success('Cycle created')
      void qc.invalidateQueries({ queryKey: ['perf-admin'] })
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Performance</h1>
        <p className="text-sm text-muted-foreground">Cycles, goals, and reviews.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New cycle</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Start</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>End</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button disabled={!name || !start || !end} onClick={() => createCycle.mutate()}>
              Create
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add goal</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
          >
            <option value="">Cycle…</option>
            {(data?.cycles || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">Employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Goal title"
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
          />
          <Button
            disabled={!cycleId || !employeeId || !goalTitle}
            onClick={async () => {
              await fetch('/api/hr/performance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'add_goal',
                  cycleId,
                  employeeId,
                  title: goalTitle,
                }),
              })
              toast.success('Goal added')
              setGoalTitle('')
              void qc.invalidateQueries({ queryKey: ['perf-admin'] })
            }}
          >
            Add goal
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cycles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.cycles || []).map((c) => (
            <div key={c.id} className="flex justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c._count.goals} goals · {c._count.reviews} reviews
                </p>
              </div>
              <Badge>{c.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
