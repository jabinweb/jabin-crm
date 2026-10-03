'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, LifeBuoy, Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
import {
  EssEmptyState,
  EssErrorState,
  EssListSkeleton,
  StatusBadge,
} from '@/components/employee/mobile/ess-states'
import { useCurrency } from '@/hooks/use-currency'

type Claim = { id: string; description: string; amount: number; status: string }
type Ticket = { id: string; subject: string; status: string }
type Policy = { id: string; title: string; fileUrl: string }

async function postJson(url: string, body: unknown, fallback: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(typeof err.error === 'string' ? err.error : fallback)
  }
}

export default function EmployeeClaimsPage() {
  const qc = useQueryClient()
  const { formatCurrency, currency } = useCurrency()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const claimsQuery = useQuery({
    queryKey: ['my-claims'],
    queryFn: async () => {
      const res = await fetch('/api/hr/claims')
      if (!res.ok) throw new Error('Failed to load claims')
      return (await res.json()) as Claim[]
    },
  })

  const ticketsQuery = useQuery({
    queryKey: ['my-hr-tickets'],
    queryFn: async () => {
      const res = await fetch('/api/hr/tickets')
      if (!res.ok) throw new Error('Failed to load tickets')
      return (await res.json()) as Ticket[]
    },
  })

  const policiesQuery = useQuery({
    queryKey: ['my-policies'],
    queryFn: async () => {
      const res = await fetch('/api/hr/policies')
      if (!res.ok) throw new Error('Failed to load policies')
      return (await res.json()) as Policy[]
    },
  })

  const amountValue = Number(amount)
  const claimValid = description.trim().length > 0 && amount !== '' && amountValue > 0

  const submitClaim = useMutation({
    mutationFn: () =>
      postJson(
        '/api/hr/claims',
        { description: description.trim(), amount: amountValue },
        "Couldn't submit your claim"
      ),
    onSuccess: () => {
      toast.success('Claim submitted for approval')
      setDescription('')
      setAmount('')
      void qc.invalidateQueries({ queryKey: ['my-claims'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submitTicket = useMutation({
    mutationFn: () =>
      postJson(
        '/api/hr/tickets',
        { subject: subject.trim(), body: body.trim() },
        "Couldn't open your ticket"
      ),
    onSuccess: () => {
      toast.success('Ticket sent to HR')
      setSubject('')
      setBody('')
      void qc.invalidateQueries({ queryKey: ['my-hr-tickets'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const claims = claimsQuery.data ?? []
  const tickets = ticketsQuery.data ?? []
  const policies = policiesQuery.data ?? []

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
      <EssPageHeader
        title="Claims & HR help"
        subtitle="Claim expenses, ask HR a question, and read company policies"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New expense claim</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (claimValid && !submitClaim.isPending) submitClaim.mutate()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="claim-description">What was it for?</Label>
              <Input
                id="claim-description"
                placeholder="e.g. Client visit cab fare"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="claim-amount">Amount ({currency})</Label>
              <Input
                id="claim-amount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {amount !== '' && !(amountValue > 0) ? (
                <p className="text-xs text-destructive">Enter an amount greater than zero.</p>
              ) : null}
            </div>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={!claimValid || submitClaim.isPending}
            >
              {submitClaim.isPending ? 'Submitting…' : 'Submit claim'}
            </Button>
          </form>

          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-medium">My claims</h3>
            {claimsQuery.isLoading ? (
              <EssListSkeleton rows={2} />
            ) : claimsQuery.isError ? (
              <EssErrorState
                message="We couldn't load your claims."
                onRetry={() => void claimsQuery.refetch()}
              />
            ) : claims.length === 0 ? (
              <EssEmptyState
                icon={Receipt}
                title="No claims yet"
                description="Submit an expense above and track its approval here."
              />
            ) : (
              claims.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="break-words">{c.description}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatCurrency(Number(c.amount) || 0)}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ask HR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (subject.trim() && !submitTicket.isPending) submitTicket.mutate()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="ticket-subject">Subject</Label>
              <Input
                id="ticket-subject"
                placeholder="e.g. Update my bank details"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-body">Details</Label>
              <Textarea
                id="ticket-body"
                placeholder="Tell HR what you need help with"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={!subject.trim() || submitTicket.isPending}
            >
              {submitTicket.isPending ? 'Sending…' : 'Send to HR'}
            </Button>
          </form>

          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-medium">My tickets</h3>
            {ticketsQuery.isLoading ? (
              <EssListSkeleton rows={2} />
            ) : ticketsQuery.isError ? (
              <EssErrorState
                message="We couldn't load your tickets."
                onRetry={() => void ticketsQuery.refetch()}
              />
            ) : tickets.length === 0 ? (
              <EssEmptyState
                icon={LifeBuoy}
                title="No tickets yet"
                description="Questions you send to HR will be tracked here."
              />
            ) : (
              tickets.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <span className="min-w-0 break-words">{t.subject}</span>
                  <StatusBadge status={t.status} />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {policiesQuery.isLoading ? (
            <EssListSkeleton rows={2} />
          ) : policiesQuery.isError ? (
            <EssErrorState
              message="We couldn't load company policies."
              onRetry={() => void policiesQuery.refetch()}
            />
          ) : policies.length === 0 ? (
            <EssEmptyState
              icon={FileText}
              title="No policies published"
              description="When HR publishes policies, you can read them here."
            />
          ) : (
            policies.map((p) => (
              <a
                key={p.id}
                href={p.fileUrl}
                className="flex min-h-[40px] items-center gap-2 break-words rounded-md px-2 py-2 text-sm underline-offset-4 hover:bg-muted hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">{p.title}</span>
              </a>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
