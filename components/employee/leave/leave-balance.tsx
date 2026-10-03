'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, CalendarDays } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { LeaveRequestForm } from './leave-request-form'
import { useState } from 'react'
import { EssErrorState, EssListSkeleton } from '@/components/employee/mobile/ess-states'

type BalanceRow = {
  id: string
  entitled: number
  used: number
  pending: number
  policy: { id: string; name: string; code: string }
}

export function LeaveBalance() {
  const [open, setOpen] = useState(false)
  const { data: balances = [], refetch, isLoading, isError } = useQuery({
    queryKey: ['leave-balances'],
    queryFn: async () => {
      const res = await fetch('/api/employee/leave/balances')
      if (!res.ok) throw new Error('Failed to load balances')
      return (await res.json()) as BalanceRow[]
    },
  })

  const noPolicies = !isLoading && !isError && balances.length === 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" aria-hidden />
          Leave balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {isLoading ? (
            <EssListSkeleton rows={2} />
          ) : isError ? (
            <EssErrorState
              message="We couldn't load your leave balance."
              onRetry={() => void refetch()}
            />
          ) : noPolicies ? (
            <p className="text-sm text-muted-foreground">
              No leave policy is assigned to you yet. Ask HR to set one up before requesting leave.
            </p>
          ) : (
            balances.map((balance) => {
              const remaining = Math.max(0, balance.entitled - balance.used - balance.pending)
              return (
                <div key={balance.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{balance.policy.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {balance.used} used · {balance.pending} pending of {balance.entitled}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-2xl font-bold tabular-nums leading-none">{remaining}</p>
                    <p className="text-[11px] text-muted-foreground">left</p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" disabled={isLoading || noPolicies}>
              <CalendarDays className="mr-2 h-4 w-4" aria-hidden />
              Request leave
            </Button>
          </DialogTrigger>
          <DialogContent className="md:max-w-xl">
            <DialogHeader>
              <DialogTitle>Request leave</DialogTitle>
              <DialogDescription>
                Pick the leave type and dates. The request goes for approval once you submit it.
              </DialogDescription>
            </DialogHeader>
            <LeaveRequestForm
              onSuccess={() => {
                setOpen(false)
                void refetch()
              }}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
