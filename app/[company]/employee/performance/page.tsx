'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
import {
  EssEmptyState,
  EssErrorState,
  EssListSkeleton,
  StatusBadge,
} from '@/components/employee/mobile/ess-states'
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

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)))

export default function EmployeePerformancePage() {
  const qc = useQueryClient()
  const [selfScores, setSelfScores] = useState<Record<string, { score: string; notes: string }>>({})

  const { data, isLoading, isError, refetch } = useQuery({
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
      toast.success('Progress saved')
      void qc.invalidateQueries({ queryKey: ['my-performance'] })
    },
    onError: () => toast.error("Couldn't save progress. Please try again."),
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
          selfScore: clampPercent(Number(entry?.score) || 0),
          selfNotes: entry?.notes || '',
        }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      toast.success('Self-review submitted')
      void qc.invalidateQueries({ queryKey: ['my-performance'] })
    },
    onError: () => toast.error("Couldn't submit your self-review. Please try again."),
  })

  const goals = data?.goals ?? []
  const reviews = data?.reviews ?? []

  const errorState = (
    <EssErrorState
      message="We couldn't load your goals and reviews."
      onRetry={() => void refetch()}
    />
  )

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
      <EssPageHeader title="Performance" subtitle="Your goals and review cycles" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My goals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <EssListSkeleton rows={2} />
          ) : isError ? (
            errorState
          ) : goals.length === 0 ? (
            <EssEmptyState
              icon={Target}
              title="No goals assigned yet"
              description="When your manager sets goals for a review cycle, you can track progress on them here."
            />
          ) : (
            goals.map((g) => (
              <div key={g.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-medium">{g.title}</p>
                  {g.cycle?.name ? (
                    <span className="shrink-0 text-xs text-muted-foreground">{g.cycle.name}</span>
                  ) : null}
                </div>
                {g.description && (
                  <p className="break-words text-xs text-muted-foreground">{g.description}</p>
                )}
                <Progress value={clampPercent(g.progress)} className="h-2" aria-hidden />
                <div className="flex items-center gap-2">
                  <Label htmlFor={`goal-progress-${g.id}`} className="text-xs text-muted-foreground">
                    Progress
                  </Label>
                  <Input
                    id={`goal-progress-${g.id}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    defaultValue={g.progress}
                    className="h-10 w-24"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                    onBlur={(e) => {
                      const next = clampPercent(Number(e.target.value) || 0)
                      e.target.value = String(next)
                      // Only save when the value actually changed
                      if (next !== g.progress) updateProgress.mutate({ goalId: g.id, progress: next })
                    }}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My reviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <EssListSkeleton rows={1} />
          ) : isError ? (
            errorState
          ) : reviews.length === 0 ? (
            <EssEmptyState
              icon={ClipboardCheck}
              title="No reviews yet"
              description="When a review cycle opens, you'll be asked for a self-review here."
            />
          ) : (
            reviews.map((r) => {
              const entry = selfScores[r.id]
              const scoreValue = entry?.score ?? ''
              const scoreNum = Number(scoreValue)
              const scoreInvalid = scoreValue !== '' && (scoreNum < 0 || scoreNum > 100)
              const submitting = submitSelfReview.isPending && submitSelfReview.variables === r.id
              return (
                <div key={r.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium">
                      {r.cycle?.name || 'Review'}
                    </p>
                    <StatusBadge status={r.status} />
                  </div>
                  {r.status === 'PENDING' ? (
                    <form
                      className="space-y-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (!scoreValue || scoreInvalid || submitting) return
                        submitSelfReview.mutate(r.id)
                      }}
                    >
                      <Label htmlFor={`self-score-${r.id}`} className="text-xs">
                        Self score (0–100)
                      </Label>
                      <Input
                        id={`self-score-${r.id}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        value={scoreValue}
                        onChange={(e) =>
                          setSelfScores((prev) => ({
                            ...prev,
                            [r.id]: { score: e.target.value, notes: prev[r.id]?.notes || '' },
                          }))
                        }
                      />
                      {scoreInvalid ? (
                        <p className="text-xs text-destructive">Enter a score between 0 and 100.</p>
                      ) : null}
                      <Label htmlFor={`self-notes-${r.id}`} className="text-xs">
                        Notes
                      </Label>
                      <Textarea
                        id={`self-notes-${r.id}`}
                        placeholder="What went well, and what you'd like to improve"
                        value={entry?.notes || ''}
                        onChange={(e) =>
                          setSelfScores((prev) => ({
                            ...prev,
                            [r.id]: { notes: e.target.value, score: prev[r.id]?.score || '' },
                          }))
                        }
                      />
                      <Button
                        type="submit"
                        className="w-full sm:w-auto"
                        disabled={!scoreValue || scoreInvalid || submitting}
                      >
                        {submitting ? 'Submitting…' : 'Submit self-review'}
                      </Button>
                    </form>
                  ) : (
                    <div className="space-y-1 text-sm">
                      <p>Self score: {r.selfScore ?? '—'}</p>
                      {r.selfNotes && (
                        <p className="break-words text-xs text-muted-foreground">{r.selfNotes}</p>
                      )}
                      {r.managerScore != null && (
                        <>
                          <p className="pt-1">Manager score: {r.managerScore}</p>
                          {r.managerNotes && (
                            <p className="break-words text-xs text-muted-foreground">
                              {r.managerNotes}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
