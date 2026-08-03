'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function ExitAdminPage() {
  const qc = useQueryClient()
  const { data: rows = [] } = useQuery({
    queryKey: ['hr-exit'],
    queryFn: async () => {
      const res = await fetch('/api/hr/exit')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Exit management</h1>
        <p className="text-sm text-muted-foreground">Clearance and offboarding.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exit requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map(
            (r: {
              id: string
              status: string
              reason: string
              lastWorkingDay: string
              clearance: { item: string; done: boolean }[]
              employee: { name: string }
            }) => (
              <div key={r.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">{r.employee.name}</p>
                    <p className="text-xs text-muted-foreground">
                      LWD {format(new Date(r.lastWorkingDay), 'd MMM yyyy')} · {r.reason}
                    </p>
                  </div>
                  <Badge>{r.status}</Badge>
                </div>
                <div className="space-y-1">
                  {(r.clearance || []).map((c, index) => (
                    <label key={index} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={c.done}
                        onChange={async () => {
                          await fetch('/api/hr/exit', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              id: r.id,
                              action: 'toggle_clearance',
                              index,
                            }),
                          })
                          void qc.invalidateQueries({ queryKey: ['hr-exit'] })
                        }}
                      />
                      {c.item}
                    </label>
                  ))}
                </div>
                {r.status !== 'COMPLETED' && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      const res = await fetch('/api/hr/exit', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: r.id, action: 'complete' }),
                      })
                      if (res.ok) {
                        toast.success('Exit completed')
                        void qc.invalidateQueries({ queryKey: ['hr-exit'] })
                      }
                    }}
                  >
                    Mark completed
                  </Button>
                )}
              </div>
            )
          )}
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No exit requests</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
