'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
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
  const [purpose, setPurpose] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [estimate, setEstimate] = useState('')

  const { data: rows = [] } = useQuery({
    queryKey: ['my-travel'],
    queryFn: async () => {
      const res = await fetch('/api/hr/travel')
      if (!res.ok) return []
      return res.json() as Promise<TravelRequest[]>
    },
  })

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, fromDate, toDate, estimate: Number(estimate) || 0 }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      toast.success('Travel request submitted')
      setPurpose('')
      setFromDate('')
      setToDate('')
      setEstimate('')
      void qc.invalidateQueries({ queryKey: ['my-travel'] })
    },
    onError: () => toast.error('Failed to submit'),
  })

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <EssPageHeader title="Travel requests" subtitle="Plan and track business travel" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Purpose</Label>
            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Estimated cost (₹)</Label>
            <Input type="number" value={estimate} onChange={(e) => setEstimate(e.target.value)} />
          </div>
          <Button
            disabled={!purpose.trim() || !fromDate || !toDate || submit.isPending}
            onClick={() => submit.mutate()}
          >
            Submit request
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{r.purpose}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.fromDate).toLocaleDateString()} –{' '}
                  {new Date(r.toDate).toLocaleDateString()} · ₹
                  {Number(r.estimate).toLocaleString('en-IN')}
                </p>
              </div>
              <Badge>{r.status}</Badge>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No travel requests yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
