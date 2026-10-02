'use client'

import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { CardListSkeleton } from '@/components/loading'
import { QueryErrorState, ensureOk } from '@/components/hr/hr-ui'
import { confirmAction } from '@/lib/confirm-action'
import { CalendarRange, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Policy = {
  id: string
  name: string
  code: string
  daysPerYear: number
  carryForwardMax: number
  isPaid: boolean
  active: boolean
}

export default function LeavePoliciesPage() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [days, setDays] = useState('12')
  const [cf, setCf] = useState('0')
  const lastYear = new Date().getFullYear() - 1

  const {
    data: policies = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['leave-policies'],
    queryFn: async () => {
      const res = await fetch('/api/hr/leave-policies')
      await ensureOk(res, 'Failed to load leave policies')
      return (await res.json()) as Policy[]
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/leave-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim(),
          daysPerYear: Number(days),
          carryForwardMax: Number(cf),
        }),
      })
      await ensureOk(res, 'Could not create the policy')
    },
    onSuccess: () => {
      toast.success('Leave policy created')
      setName('')
      setCode('')
      setDays('12')
      setCf('0')
      void qc.invalidateQueries({ queryKey: ['leave-policies'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggle = useMutation({
    mutationFn: async (p: Policy) => {
      const res = await fetch('/api/hr/leave-policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, active: !p.active }),
      })
      await ensureOk(res, 'Could not update the policy')
    },
    onSuccess: (_d, p) => {
      toast.success(p.active ? `${p.name} deactivated` : `${p.name} activated`)
      void qc.invalidateQueries({ queryKey: ['leave-policies'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const carryForward = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/leave-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'carry_forward', fromYear: lastYear }),
      })
      await ensureOk(res, 'Carry-forward failed')
      return (await res.json()) as { balancesUpdated?: number }
    },
    onSuccess: (r) => toast.success(`Updated ${r.balancesUpdated ?? 0} leave balances`),
    onError: (e: Error) => toast.error(e.message),
  })

  const daysNum = Number(days)
  const cfNum = Number(cf)
  const numbersValid =
    days.trim() !== '' && Number.isFinite(daysNum) && daysNum >= 0 && Number.isFinite(cfNum) && cfNum >= 0
  const canCreate = name.trim() && code.trim() && numbersValid && !create.isPending

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (canCreate) create.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Leave policies</h1>
        <p className="text-sm text-muted-foreground">
          Leave types, yearly entitlement and how many unused days carry over.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add policy</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="lp-name">Name</Label>
                <Input
                  id="lp-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Casual leave"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lp-code">Short code</Label>
                <Input
                  id="lp-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="CL"
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lp-days">Days per year</Label>
                <Input
                  id="lp-days"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  type="number"
                  inputMode="decimal"
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lp-cf">Max days carried over</Label>
                <Input
                  id="lp-cf"
                  value={cf}
                  onChange={(e) => setCf(e.target.value)}
                  type="number"
                  inputMode="decimal"
                  min={0}
                />
              </div>
            </div>
            {!numbersValid && (
              <p className="text-xs text-destructive">Days must be zero or more.</p>
            )}
            <Button type="submit" className="w-full sm:w-auto" disabled={!canCreate}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create policy
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <CardListSkeleton rows={3} />
          ) : isError ? (
            <QueryErrorState title="Couldn’t load leave policies" onRetry={() => void refetch()} />
          ) : policies.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title="No leave policies yet"
              description="Create policies such as Casual, Sick and Earned leave so employees can apply."
            />
          ) : (
            policies.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="break-words font-medium">
                    {p.name} <span className="text-xs text-muted-foreground">({p.code})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.daysPerYear} days a year · up to {p.carryForwardMax} carried over
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.active ? 'default' : 'secondary'}>
                    {p.active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button
                    variant="outline"
                    disabled={toggle.isPending && toggle.variables?.id === p.id}
                    onClick={async () => {
                      if (p.active) {
                        const ok = await confirmAction({
                          title: `Deactivate ${p.name}?`,
                          description: 'Employees will no longer be able to apply for this leave type.',
                          confirmLabel: 'Deactivate',
                          variant: 'destructive',
                        })
                        if (!ok) return
                      }
                      toggle.mutate(p)
                    }}
                  >
                    {p.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Year-end carry-forward</CardTitle>
          <CardDescription>
            Moves each employee’s unused {lastYear} leave into {lastYear + 1}, up to each policy’s carry-over limit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={carryForward.isPending}
            onClick={async () => {
              const ok = await confirmAction({
                title: `Run carry-forward from ${lastYear}?`,
                description: 'This updates leave balances for every employee. Run it once, after the year closes.',
                confirmLabel: 'Run carry-forward',
              })
              if (ok) carryForward.mutate()
            }}
          >
            {carryForward.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Run carry-forward
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
