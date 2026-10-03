'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Plane } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
import {
  EssEmptyState,
  EssErrorState,
  EssListSkeleton,
  StatusBadge,
} from '@/components/employee/mobile/ess-states'
import { useCurrency } from '@/hooks/use-currency'
import { toast } from 'sonner'

type TravelRequest = {
  id: string
  purpose: string
  fromDate: string
  toDate: string
  estimate: number
  status: string
}

export default function EmployeeTravelPage() {
  const qc = useQueryClient()
  const { formatCurrency, currency } = useCurrency()
  const [purpose, setPurpose] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [estimate, setEstimate] = useState('')

  const {
    data: rows = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['my-travel'],
    queryFn: async () => {
      const res = await fetch('/api/hr/travel')
      if (!res.ok) throw new Error('Failed to load travel requests')
      return res.json() as Promise<TravelRequest[]>
    },
  })

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: purpose.trim(),
          fromDate,
          toDate,
          estimate: Number(estimate) || 0,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(typeof err.error === 'string' ? err.error : "Couldn't submit your travel request")
      }
    },
    onSuccess: () => {
      toast.success('Travel request submitted for approval')
      setPurpose('')
      setFromDate('')
      setToDate('')
      setEstimate('')
      void qc.invalidateQueries({ queryKey: ['my-travel'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const datesInvalid = Boolean(fromDate && toDate && toDate < fromDate)
  const canSubmit =
    purpose.trim().length > 0 && Boolean(fromDate) && Boolean(toDate) && !datesInvalid && !submit.isPending

  const formatDay = (value: string) => format(new Date(value), 'd MMM yyyy')

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
      <EssPageHeader title="Travel requests" subtitle="Plan and track business travel" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New request</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (canSubmit) submit.mutate()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="travel-purpose">Purpose</Label>
              <Input
                id="travel-purpose"
                placeholder="e.g. Client workshop in Pune"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <div className="space-y-1.5">
                <Label htmlFor="travel-from">From</Label>
                <Input
                  id="travel-from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="travel-to">To</Label>
                <Input
                  id="travel-to"
                  type="date"
                  min={fromDate || undefined}
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
            {datesInvalid ? (
              <p className="text-xs text-destructive">The return date can't be before the start date.</p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="travel-estimate">Estimated cost ({currency}, optional)</Label>
              <Input
                id="travel-estimate"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={!canSubmit}>
              {submit.isPending ? 'Submitting…' : 'Submit request'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <EssListSkeleton rows={2} />
          ) : isError ? (
            <EssErrorState
              message="We couldn't load your travel requests."
              onRetry={() => void refetch()}
            />
          ) : rows.length === 0 ? (
            <EssEmptyState
              icon={Plane}
              title="No travel requests yet"
              description="Fill in the form above before a business trip. Approval status shows up here."
            />
          ) : (
            rows.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm">
                <div className="min-w-0">
                  <p className="break-words font-medium">{r.purpose}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDay(r.fromDate)} – {formatDay(r.toDate)}
                    {Number(r.estimate) > 0 ? ` · ${formatCurrency(Number(r.estimate))}` : ''}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
