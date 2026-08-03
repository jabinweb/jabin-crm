'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type Timesheet = {
  id: string
  weekStart: string
  status: string
  employee?: { name: string; employeeId: string } | null
  entries: { date: string; hours: number; note?: string | null }[]
}

export default function TimesheetsAdminPage() {
  const qc = useQueryClient()
  const { data: sheets = [], isLoading } = useQuery({
    queryKey: ['timesheets-admin'],
    queryFn: async () => {
      const res = await fetch('/api/hr/timesheets?admin=1')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<Timesheet[]>
    },
  })

  const act = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const res = await fetch('/api/hr/timesheets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (!res.ok) {
      toast.error('Failed')
      return
    }
    toast.success(status === 'APPROVED' ? 'Approved' : 'Rejected')
    void qc.invalidateQueries({ queryKey: ['timesheets-admin'] })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Timesheets</h1>
        <p className="text-sm text-muted-foreground">
          Review submitted weekly timesheets across the company.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {sheets.map((s) => {
            const total = s.entries.reduce((a, e) => a + e.hours, 0)
            return (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">
                    {s.employee?.name || 'Unknown'}{' '}
                    <span className="text-xs text-muted-foreground">
                      ({s.employee?.employeeId})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Week of {new Date(s.weekStart).toLocaleDateString()} · {total} hrs
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{s.status}</Badge>
                  {s.status === 'SUBMITTED' && (
                    <>
                      <Button size="sm" onClick={() => act(s.id, 'APPROVED')}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => act(s.id, 'REJECTED')}>
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          {!isLoading && sheets.length === 0 && (
            <p className="text-sm text-muted-foreground">No timesheets submitted yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
