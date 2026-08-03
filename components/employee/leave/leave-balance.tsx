'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, CalendarDays } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { LeaveRequestForm } from './leave-request-form'
import { useState } from 'react'

type BalanceRow = {
  id: string
  entitled: number
  used: number
  pending: number
  policy: { id: string; name: string; code: string }
}

export function LeaveBalance() {
  const [open, setOpen] = useState(false)
  const { data: balances = [], refetch, isLoading } = useQuery({
    queryKey: ['leave-balances'],
    queryFn: async () => {
      const res = await fetch('/api/employee/leave/balances')
      if (!res.ok) throw new Error('Failed to load balances')
      return (await res.json()) as BalanceRow[]
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Leave Balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading balances…</p>
          )}
          {!isLoading && balances.length === 0 && (
            <p className="text-sm text-muted-foreground">No leave policies yet.</p>
          )}
          {balances.map((balance) => {
            const remaining = balance.entitled - balance.used - balance.pending
            return (
              <div
                key={balance.id}
                className="flex justify-between items-center"
              >
                <div>
                  <p className="font-medium">{balance.policy.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {balance.used} used · {balance.pending} pending of{' '}
                    {balance.entitled}
                  </p>
                </div>
                <div className="text-2xl font-bold tabular-nums">{remaining}</div>
              </div>
            )
          })}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <CalendarDays className="mr-2 h-4 w-4" />
              Request Leave
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Leave</DialogTitle>
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
