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

type Goal = {
  id: string
  title: string
  description?: string | null
  weight: number
  progress: number
  cycle?: { name: string } | null
}

type Review = {
  id: string
  status: string
  selfScore?: number | null
  selfNotes?: string | null
  managerScore?: number | null
  managerNotes?: string | null
  cycle?: { name: string } | null
}

export default function EmployeePerformancePage() {
  const qc = useQueryClient()
  const [selfScores, setSelfScores] = useState<Record<string, { score: string; notes: string }>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['my-performance'],
    queryFn: async () => {
      const res = await fetch('/api/hr/performance')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{ goals: Goal[]; reviews: Review[] }>
    },
  })

  const updateProgress = useMutation({
    mutationFn: async ({ goalId, progress }: { goalId: string; progress: number }) => {
      const res = await fetch('/api/hr/performance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_goal_progress', goalId, progress }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      toast.success('Progress updated')
      void qc.invalidateQueries({ queryKey: ['my-performance'] })
    },
  })

  const submitSelfReview = useMutation({
    mutationFn: async (reviewId: string) => {
      const entry = selfScores[reviewId]
      const res = await fetch('/api/hr/performance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'self_review',
          reviewId,
          selfScore: Number(entry?.score) || 0,
          selfNotes: entry?.notes || '',
        }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      toast.success('Self-review submitted')
      void qc.invalidateQueries({ queryKey: ['my-performance'] })
    },
    onError: () => toast.error('Failed to submit self-review'),
  })

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <EssPageHeader title="Performance" subtitle="Goals and reviews" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My goals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {(data?.goals || []).map((g) => (
            <div key={g.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{g.title}</p>
                <span className="text-xs text-muted-foreground">{g.cycle?.name}</span>
              </div>
              {g.description && (
                <p className="text-xs text-muted-foreground">{g.description}</p>
              )}
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={g.progress}
                  className="w-24"
                  onBlur={(e) =>
                    updateProgress.mutate({ goalId: g.id, progress: Number(e.target.value) || 0 })
                  }
                />
                <span className="text-xs text-muted-foreground">% progress</span>
              </div>
            </div>
          ))}
          {!isLoading && (data?.goals || []).length === 0 && (
            <p className="text-sm text-muted-foreground">No goals assigned yet.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My reviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(data?.reviews || []).map((r) => (
            <div key={r.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{r.cycle?.name}</p>
                <Badge>{r.status}</Badge>
              </div>
              {r.status === 'PENDING' ? (
                <div className="space-y-2">
                  <Label className="text-xs">Self score (0-100)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={selfScores[r.id]?.score || ''}
                    onChange={(e) =>
                      setSelfScores((prev) => ({
                        ...prev,
                        [r.id]: { ...prev[r.id], score: e.target.value, notes: prev[r.id]?.notes || '' },
                      }))
                    }
                  />
                  <Textarea
                    placeholder="Self-assessment notes…"
                    value={selfScores[r.id]?.notes || ''}
                    onChange={(e) =>
                      setSelfScores((prev) => ({
                        ...prev,
                        [r.id]: { ...prev[r.id], notes: e.target.value, score: prev[r.id]?.score || '' },
                      }))
                    }
                  />
                  <Button size="sm" onClick={() => submitSelfReview.mutate(r.id)}>
                    Submit self-review
                  </Button>
                </div>
              ) : (
                <div className="text-sm space-y-1">
                  <p>Self score: {r.selfScore ?? '—'}</p>
                  {r.selfNotes && (
                    <p className="text-xs text-muted-foreground">{r.selfNotes}</p>
                  )}
                  {r.managerScore != null && (
                    <>
                      <p className="pt-1">Manager score: {r.managerScore}</p>
                      {r.managerNotes && (
                        <p className="text-xs text-muted-foreground">{r.managerNotes}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {!isLoading && (data?.reviews || []).length === 0 && (
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
