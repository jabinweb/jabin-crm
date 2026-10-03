'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { CardListSkeleton } from '@/components/loading'
import { QueryErrorState, StatusBadge, ensureOk, humanizeEnum } from '@/components/hr/hr-ui'
import { useCurrency } from '@/hooks/use-currency'
import { Loader2, Receipt } from 'lucide-react'
import { toast } from 'sonner'

type Claim = {
  id: string
  description: string
  amount: number
  status: string
  category: string
  employee?: { name: string; employeeId: string } | null
}

export default function HrClaimsAdminPage() {
  const qc = useQueryClient()
  const { formatCurrency } = useCurrency()
  const {
    data: claims = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['hr-claims-admin'],
    queryFn: async () => {
      const res = await fetch('/api/hr/claims?admin=1')
      await ensureOk(res, 'Failed to load claims')
      return res.json() as Promise<Claim[]>
    },
  })

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) => {
      const res = await fetch('/api/hr/claims', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await ensureOk(res, 'Could not update the claim')
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === 'APPROVED' ? 'Claim approved' : 'Claim rejected')
      void qc.invalidateQueries({ queryKey: ['hr-claims-admin'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Expense claims</h1>
        <p className="text-sm text-muted-foreground">Approve reimbursable employee claims.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending and recent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <CardListSkeleton rows={4} />
          ) : isError ? (
            <QueryErrorState title="Couldn’t load claims" onRetry={() => void refetch()} />
          ) : claims.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expense claims"
              description="Claims employees submit from their portal will appear here for approval."
            />
          ) : (
            claims.map((c) => {
              const busy = decide.isPending && decide.variables?.id === c.id
              return (
                <div
                  key={c.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">{c.description}</p>
                    <p className="break-words text-xs text-muted-foreground">
                      {[c.employee?.name, humanizeEnum(c.category), // Employees enter claim amounts in ₹ (employee portal), so format as INR.
                        formatCurrency(c.amount, 'INR')]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={c.status} />
                    {c.status === 'PENDING' && (
                      <>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => decide.mutate({ id: c.id, status: 'REJECTED' })}
                        >
                          Reject
                        </Button>
                        <Button
                          disabled={busy}
                          onClick={() => decide.mutate({ id: c.id, status: 'APPROVED' })}
                        >
                          {busy && decide.variables?.status === 'APPROVED' && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Approve
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
