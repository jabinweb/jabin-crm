'use client'

import { useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { AlertTriangle, Briefcase, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Job = { id: string; title: string; department: string | null; description: string }

export default function CareersPage() {
  const { company } = useParams() as { company: string }
  const formRef = useRef<HTMLDivElement>(null)
  const [jobId, setJobId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [appliedFor, setAppliedFor] = useState<string | null>(null)

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['careers', company],
    queryFn: async () => {
      const res = await fetch(`/api/careers/${company}`)
      if (res.status === 404) throw new Error('not-found')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{ company: { name: string }; jobs: Job[] }>
    },
    retry: (count, err) => err.message !== 'not-found' && count < 2,
  })

  const jobs = data?.jobs ?? []
  const selectedJob = jobs.find((j) => j.id === jobId)

  const apply = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/careers/${company}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, name, email, phone, source: 'careers' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(
          res.status === 400 ? 'Check your name and email, then try again.' : body.error || 'Failed'
        )
      }
    },
    onSuccess: () => {
      toast.success('Application submitted')
      setAppliedFor(selectedJob?.title ?? 'this role')
      setJobId('')
      setName('')
      setEmail('')
      setPhone('')
    },
    onError: (e: Error) =>
      toast.error(e.message === 'Failed' ? 'Could not submit your application. Please try again.' : e.message),
  })

  const chooseJob = (id: string) => {
    setJobId(id)
    setAppliedFor(null)
    // Let the form render, then bring it into view (it sits below the job list)
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    )
  }

  const notFound = isError && error instanceof Error && error.message === 'not-found'

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-12">
      <div>
        <p className="text-sm text-muted-foreground">Careers</p>
        {isLoading ? (
          <Skeleton className="mt-1 h-9 w-56" />
        ) : (
          <h1 className="text-3xl font-semibold tracking-tight break-words">
            {data?.company.name ? `Work at ${data.company.name}` : 'Open roles'}
          </h1>
        )}
      </div>

      {appliedFor ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Thanks — your application for <span className="font-medium">{appliedFor}</span> has
            been received. The hiring team will contact you by email.
          </p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardHeader className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : notFound ? (
        <Card>
          <EmptyState
            icon={Briefcase}
            title="This careers page isn't available"
            description="Check the link you were given, or contact the company directly."
          />
        </Card>
      ) : isError ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="We couldn't load open roles"
            description="Check your connection and try again."
            actionLabel={isRefetching ? 'Retrying…' : 'Try again'}
            onAction={() => void refetch()}
          />
        </Card>
      ) : jobs.length === 0 ? (
        <Card>
          <EmptyState
            icon={Briefcase}
            title="No open positions right now"
            description="New roles are posted here as they open — check back soon."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((j) => (
            <Card key={j.id} className={cn(j.id === jobId && 'ring-2 ring-primary')}>
              <CardHeader>
                <CardTitle className="text-lg break-words">{j.title}</CardTitle>
                {j.department && (
                  <p className="text-sm text-muted-foreground">{j.department}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm whitespace-pre-wrap break-words">{j.description}</p>
                <Button
                  variant={j.id === jobId ? 'default' : 'outline'}
                  onClick={() => chooseJob(j.id)}
                  aria-pressed={j.id === jobId}
                >
                  {j.id === jobId ? 'Selected — fill in the form below' : 'Apply for this role'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedJob && (
        <div ref={formRef} className="scroll-mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Apply for {selectedJob.title}</CardTitle>
              <CardDescription>We&apos;ll use these details to contact you about this role.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!name.trim() || !email.trim() || apply.isPending) return
                  apply.mutate()
                }}
              >
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="careers-name">Full name</Label>
                  <Input
                    id="careers-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="careers-email">Email</Label>
                  <Input
                    id="careers-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="careers-phone">
                    Phone <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="careers-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    type="tel"
                    autoComplete="tel"
                  />
                </div>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button type="submit" disabled={!name.trim() || !email.trim() || apply.isPending}>
                    {apply.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      'Submit application'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={apply.isPending}
                    onClick={() => setJobId('')}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
