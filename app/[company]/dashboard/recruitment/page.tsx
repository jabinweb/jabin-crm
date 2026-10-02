'use client'

import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { CardListSkeleton } from '@/components/loading'
import { QueryErrorState, ensureOk, humanizeEnum } from '@/components/hr/hr-ui'
import { confirmAction } from '@/lib/confirm-action'
import { cn } from '@/lib/utils'
import { Briefcase, Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

const STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED']

type Job = { id: string; title: string; status: string; _count?: { applications: number } }
type Application = {
  id: string
  stage: string
  candidate: { name: string; email: string }
  job: { title: string }
}

const postJson = (body: unknown) =>
  fetch('/api/hr/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export default function RecruitmentPage() {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [candName, setCandName] = useState('')
  const [candEmail, setCandEmail] = useState('')
  const [jobId, setJobId] = useState('')

  const jobsQuery = useQuery({
    queryKey: ['hr-jobs'],
    queryFn: async () => {
      const res = await fetch('/api/hr/jobs')
      await ensureOk(res, 'Failed to load openings')
      return (await res.json()) as Job[]
    },
  })
  const jobs = jobsQuery.data ?? []

  const appsQuery = useQuery({
    queryKey: ['hr-apps', jobId],
    queryFn: async () => {
      const q = jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''
      const res = await fetch(`/api/hr/applications${q}`)
      await ensureOk(res, 'Failed to load candidates')
      return (await res.json()) as Application[]
    },
  })
  const apps = appsQuery.data ?? []
  const selectedJob = jobs.find((j) => j.id === jobId)

  const refreshPipeline = () => {
    void qc.invalidateQueries({ queryKey: ['hr-apps'] })
    void qc.invalidateQueries({ queryKey: ['hr-jobs'] })
  }

  const createJob = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      })
      await ensureOk(res, 'Could not post the job')
    },
    onSuccess: () => {
      toast.success('Job posted')
      setTitle('')
      setDescription('')
      void qc.invalidateQueries({ queryKey: ['hr-jobs'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const addCandidate = useMutation({
    mutationFn: async () => {
      const res = await postJson({
        action: 'add_candidate',
        jobId,
        name: candName.trim(),
        email: candEmail.trim(),
      })
      await ensureOk(res, 'Could not add the candidate')
    },
    onSuccess: () => {
      toast.success(`${candName.trim()} added to the pipeline`)
      setCandName('')
      setCandEmail('')
      refreshPipeline()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const setStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const res = await postJson({ action: 'set_stage', id, stage })
      await ensureOk(res, 'Could not move the candidate')
    },
    onSuccess: (_d, v) => {
      toast.success(`Moved to ${humanizeEnum(v.stage).toLowerCase()}`)
      void qc.invalidateQueries({ queryKey: ['hr-apps'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const hire = useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await postJson({ action: 'hire', applicationId })
      await ensureOk(res, 'Hire failed')
    },
    onSuccess: () => {
      toast.success('Hired', { description: 'An employee record was created and onboarding started.' })
      refreshPipeline()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const emailValid = /^\S+@\S+\.\S+$/.test(candEmail.trim())

  const onPostJob = (e: FormEvent) => {
    e.preventDefault()
    if (title.trim() && description.trim() && !createJob.isPending) createJob.mutate()
  }
  const onAddCandidate = (e: FormEvent) => {
    e.preventDefault()
    if (jobId && candName.trim() && emailValid && !addCandidate.isPending) addCandidate.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Recruitment</h1>
        <p className="text-sm text-muted-foreground">
          Post openings, add candidates and move them through your hiring pipeline.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Post a job</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onPostJob} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="job-title">Job title</Label>
                <Input
                  id="job-title"
                  placeholder="Field sales executive"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-desc">Description</Label>
                <Textarea
                  id="job-desc"
                  rows={4}
                  placeholder="Responsibilities, location, experience…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={!title.trim() || !description.trim() || createJob.isPending}
              >
                {createJob.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Post job
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a candidate</CardTitle>
            <CardDescription>Candidates start in the Applied stage.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onAddCandidate} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="cand-job">Opening</Label>
                <Select value={jobId || undefined} onValueChange={setJobId} disabled={jobs.length === 0}>
                  <SelectTrigger id="cand-job">
                    <SelectValue placeholder={jobs.length === 0 ? 'Post a job first' : 'Select opening'} />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cand-name">Name</Label>
                  <Input
                    id="cand-name"
                    autoComplete="off"
                    value={candName}
                    onChange={(e) => setCandName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cand-email">Email</Label>
                  <Input
                    id="cand-email"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    value={candEmail}
                    onChange={(e) => setCandEmail(e.target.value)}
                    aria-invalid={(candEmail.length > 0 && !emailValid) || undefined}
                  />
                  {candEmail.length > 0 && !emailValid && (
                    <p className="text-xs text-destructive">Enter a valid email address.</p>
                  )}
                </div>
              </div>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={!jobId || !candName.trim() || !emailValid || addCandidate.isPending}
              >
                {addCandidate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add to pipeline
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Openings</CardTitle>
          <CardDescription>Select an opening to filter the pipeline.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {jobsQuery.isLoading ? (
            <CardListSkeleton rows={2} />
          ) : jobsQuery.isError ? (
            <QueryErrorState title="Couldn’t load openings" onRetry={() => void jobsQuery.refetch()} />
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No openings yet"
              description="Post your first job above to start collecting candidates."
            />
          ) : (
            <>
              <button
                type="button"
                aria-pressed={!jobId}
                className={cn(
                  'flex min-h-[2.75rem] w-full items-center rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  !jobId && 'border-primary bg-muted/40'
                )}
                onClick={() => setJobId('')}
              >
                All openings
              </button>
              {jobs.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  aria-pressed={jobId === j.id}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    jobId === j.id && 'border-primary bg-muted/40'
                  )}
                  onClick={() => setJobId(j.id)}
                >
                  <div className="flex min-h-[1.75rem] items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">{j.title}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline">{humanizeEnum(j.status)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {j._count?.applications ?? 0} candidate
                        {(j._count?.applications ?? 0) === 1 ? '' : 's'}
                      </span>
                    </span>
                  </div>
                </button>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Pipeline{selectedJob ? ` · ${selectedJob.title}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {appsQuery.isLoading ? (
            <CardListSkeleton rows={3} />
          ) : appsQuery.isError ? (
            <QueryErrorState title="Couldn’t load candidates" onRetry={() => void appsQuery.refetch()} />
          ) : apps.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="No candidates yet"
              description={
                jobs.length === 0
                  ? 'Post a job, then add candidates to it.'
                  : 'Add a candidate to an opening using the form above.'
              }
            />
          ) : (
            apps.map((a) => {
              const busy =
                (setStage.isPending && setStage.variables?.id === a.id) ||
                (hire.isPending && hire.variables === a.id)
              return (
                <div
                  key={a.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.candidate.name}</p>
                    <p className="break-words text-xs text-muted-foreground">
                      {a.job.title} · {a.candidate.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={a.stage}
                      disabled={busy}
                      onValueChange={(stage) => setStage.mutate({ id: a.id, stage })}
                    >
                      <SelectTrigger
                        className="w-full sm:w-[160px]"
                        aria-label={`Stage for ${a.candidate.name}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {humanizeEnum(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {a.stage !== 'HIRED' && a.stage !== 'REJECTED' && (
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={busy}
                        onClick={async () => {
                          const ok = await confirmAction({
                            title: `Hire ${a.candidate.name}?`,
                            description: `Creates an employee record for ${a.job.title} and starts onboarding.`,
                            confirmLabel: 'Hire',
                          })
                          if (ok) hire.mutate(a.id)
                        }}
                      >
                        {hire.isPending && hire.variables === a.id && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Hire
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
