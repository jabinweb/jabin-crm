'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { toast } from 'sonner'

const STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED']

export default function RecruitmentPage() {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [candName, setCandName] = useState('')
  const [candEmail, setCandEmail] = useState('')
  const [jobId, setJobId] = useState('')

  const { data: jobs = [] } = useQuery({
    queryKey: ['hr-jobs'],
    queryFn: async () => {
      const res = await fetch('/api/hr/jobs')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  const { data: apps = [] } = useQuery({
    queryKey: ['hr-apps', jobId],
    queryFn: async () => {
      const q = jobId ? `?jobId=${jobId}` : ''
      const res = await fetch(`/api/hr/applications${q}`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  const createJob = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      toast.success('Job posted')
      setTitle('')
      setDescription('')
      void qc.invalidateQueries({ queryKey: ['hr-jobs'] })
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Recruitment</h1>
        <p className="text-sm text-muted-foreground">
          Jobs, candidates, and hiring pipeline.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Post job</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button
            disabled={!title || !description || createJob.isPending}
            onClick={() => createJob.mutate()}
          >
            Create opening
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Openings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {jobs.map(
            (j: {
              id: string
              title: string
              status: string
              _count?: { applications: number }
            }) => (
              <button
                key={j.id}
                type="button"
                className="w-full text-left rounded-lg border px-3 py-2 hover:bg-muted/40"
                onClick={() => setJobId(j.id)}
              >
                <div className="flex justify-between">
                  <span className="font-medium">{j.title}</span>
                  <Badge variant="secondary">
                    {j.status} · {j._count?.applications ?? 0}
                  </Badge>
                </div>
              </button>
            )
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add candidate</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Select value={jobId || undefined} onValueChange={setJobId}>
            <SelectTrigger>
              <SelectValue placeholder="Select job" />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((j: { id: string; title: string }) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Name"
            value={candName}
            onChange={(e) => setCandName(e.target.value)}
          />
          <Input
            placeholder="Email"
            value={candEmail}
            onChange={(e) => setCandEmail(e.target.value)}
          />
          <Button
            className="sm:col-span-3 w-fit"
            disabled={!jobId || !candName || !candEmail}
            onClick={async () => {
              const res = await fetch('/api/hr/applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'add_candidate',
                  jobId,
                  name: candName,
                  email: candEmail,
                }),
              })
              if (res.ok) {
                toast.success('Candidate added')
                setCandName('')
                setCandEmail('')
                void qc.invalidateQueries({ queryKey: ['hr-apps'] })
                void qc.invalidateQueries({ queryKey: ['hr-jobs'] })
              } else toast.error('Failed')
            }}
          >
            Add to pipeline
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {apps.map(
            (a: {
              id: string
              stage: string
              candidate: { name: string; email: string }
              job: { title: string }
            }) => (
              <div
                key={a.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{a.candidate.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.job.title} · {a.candidate.email}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={a.stage}
                  onValueChange={async (stage) => {
                    await fetch('/api/hr/applications', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'set_stage', id: a.id, stage }),
                    })
                    void qc.invalidateQueries({ queryKey: ['hr-apps'] })
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {a.stage !== 'HIRED' && a.stage !== 'REJECTED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const res = await fetch('/api/hr/applications', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'hire', applicationId: a.id }),
                      })
                      if (res.ok) {
                        toast.success('Hired — employee + onboarding started')
                        void qc.invalidateQueries({ queryKey: ['hr-apps'] })
                      } else toast.error('Hire failed')
                    }}
                  >
                    Hire
                  </Button>
                )}
                </div>
              </div>
            )
          )}
          {apps.length === 0 && (
            <p className="text-sm text-muted-foreground">No applications yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
