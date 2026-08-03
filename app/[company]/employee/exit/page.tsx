'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function EmployeeExitPage() {
  const qc = useQueryClient()
  const [lastWorkingDay, setLastWorkingDay] = useState('')
  const [reason, setReason] = useState('')

  const { data: rows = [] } = useQuery({
    queryKey: ['my-exit'],
    queryFn: async () => {
      const res = await fetch('/api/hr/exit')
      if (!res.ok) return []
      return res.json()
    },
  })

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastWorkingDay, reason }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      toast.success('Exit request submitted')
      void qc.invalidateQueries({ queryKey: ['my-exit'] })
    },
    onError: () => toast.error('Could not submit'),
  })

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <EssPageHeader title="Exit request" subtitle="Resignation & clearance" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submit resignation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Last working day</Label>
            <Input
              type="date"
              value={lastWorkingDay}
              onChange={(e) => setLastWorkingDay(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button
            className="w-full"
            disabled={!lastWorkingDay || !reason || submit.isPending}
            onClick={() => submit.mutate()}
          >
            Submit
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map(
            (r: {
              id: string
              status: string
              lastWorkingDay: string
              clearance: { item: string; done: boolean }[]
            }) => (
              <div key={r.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex justify-between">
                  <p className="text-sm">
                    LWD {format(new Date(r.lastWorkingDay), 'd MMM yyyy')}
                  </p>
                  <Badge>{r.status}</Badge>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {(r.clearance || []).map((c, i) => (
                    <li key={i}>
                      {c.done ? '✓' : '○'} {c.item}
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  )
}
