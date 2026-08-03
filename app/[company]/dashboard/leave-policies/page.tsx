'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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

  const { data: policies = [] } = useQuery({
    queryKey: ['leave-policies'],
    queryFn: async () => {
      const res = await fetch('/api/hr/leave-policies')
      if (!res.ok) throw new Error('Failed')
      return (await res.json()) as Policy[]
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/leave-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code,
          daysPerYear: Number(days),
          carryForwardMax: Number(cf),
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed')
    },
    onSuccess: () => {
      toast.success('Policy created')
      setName('')
      setCode('')
      void qc.invalidateQueries({ queryKey: ['leave-policies'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Leave policies</h1>
        <p className="text-sm text-muted-foreground">
          Types, entitlement, and carry-forward caps.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add policy</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-5">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CL" />
          </div>
          <div className="space-y-1">
            <Label>Days / year</Label>
            <Input value={days} onChange={(e) => setDays(e.target.value)} type="number" />
          </div>
          <div className="space-y-1">
            <Label>Carry forward max</Label>
            <Input value={cf} onChange={(e) => setCf(e.target.value)} type="number" />
          </div>
          <div className="flex items-end gap-2">
            <Button
              disabled={!name || !code || create.isPending}
              onClick={() => create.mutate()}
            >
              Create
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const res = await fetch('/api/hr/leave-policies', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'carry_forward',
                    fromYear: new Date().getFullYear() - 1,
                  }),
                })
                if (!res.ok) toast.error('Carry-forward failed')
                else {
                  const r = await res.json()
                  toast.success(`Updated ${r.balancesUpdated} balances`)
                }
              }}
            >
              Run Y/E carry-forward
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {policies.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div>
                <p className="font-medium">
                  {p.name}{' '}
                  <span className="text-xs text-muted-foreground">({p.code})</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.daysPerYear} days / yr · CF max {p.carryForwardMax}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={p.active ? 'default' : 'secondary'}>
                  {p.active ? 'Active' : 'Inactive'}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await fetch('/api/hr/leave-policies', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: p.id, active: !p.active }),
                    })
                    void qc.invalidateQueries({ queryKey: ['leave-policies'] })
                  }}
                >
                  Toggle
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
