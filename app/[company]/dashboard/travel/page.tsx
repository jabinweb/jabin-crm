'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type TravelRequest = {
  id: string
  purpose: string
  fromDate: string
  toDate: string
  estimate: number
  status: string
  employee?: { name: string; employeeId: string } | null
}

export default function TravelAdminPage() {
  const qc = useQueryClient()
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['travel-admin'],
    queryFn: async () => {
      const res = await fetch('/api/hr/travel?admin=1')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<TravelRequest[]>
    },
  })

  const act = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const res = await fetch('/api/hr/travel', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (!res.ok) {
      toast.error('Failed')
      return
    }
    toast.success(status === 'APPROVED' ? 'Approved' : 'Rejected')
    void qc.invalidateQueries({ queryKey: ['travel-admin'] })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Travel requests</h1>
        <p className="text-sm text-muted-foreground">
          Approve or reject employee travel requests.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div>
                <p className="font-medium">
                  {r.purpose}{' '}
                  <span className="text-xs text-muted-foreground">
                    ({r.employee?.name} · {r.employee?.employeeId})
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.fromDate).toLocaleDateString()} –{' '}
                  {new Date(r.toDate).toLocaleDateString()} · Est. ₹
                  {Number(r.estimate).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{r.status}</Badge>
                {r.status === 'PENDING' && (
                  <>
                    <Button size="sm" onClick={() => act(r.id, 'APPROVED')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => act(r.id, 'REJECTED')}>
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {!isLoading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No travel requests yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
