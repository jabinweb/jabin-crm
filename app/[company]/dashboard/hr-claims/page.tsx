'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export default function HrClaimsAdminPage() {
  const qc = useQueryClient()
  const { data: claims = [] } = useQuery({
    queryKey: ['hr-claims-admin'],
    queryFn: async () => {
      const res = await fetch('/api/hr/claims?admin=1')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<
        {
          id: string
          description: string
          amount: number
          status: string
          category: string
          employee?: { name: string; employeeId: string } | null
        }[]
      >
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Expense claims</h1>
        <p className="text-sm text-muted-foreground">Approve reimbursable employee claims.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending / recent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {claims.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <p className="font-medium">{c.description}</p>
                <p className="text-xs text-muted-foreground">
                  {c.employee?.name} · {c.category} · ₹{c.amount.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{c.status}</Badge>
                {c.status === 'PENDING' && (
                  <>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await fetch('/api/hr/claims', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: c.id, status: 'APPROVED' }),
                        })
                        toast.success('Approved')
                        void qc.invalidateQueries({ queryKey: ['hr-claims-admin'] })
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await fetch('/api/hr/claims', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: c.id, status: 'REJECTED' }),
                        })
                        void qc.invalidateQueries({ queryKey: ['hr-claims-admin'] })
                      }}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
