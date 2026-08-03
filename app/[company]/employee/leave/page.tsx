'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from '@/hooks/use-toast'
import { LeaveBalance } from '@/components/employee/leave/leave-balance'
import { format } from 'date-fns'
import { CalendarDays } from 'lucide-react'

interface LeaveRequest {
  id: string
  startDate: string
  endDate: string
  type: string
  reason: string
  status: string
  days?: number
  createdAt: string
  policy?: { name: string; code: string } | null
}

interface Holiday {
  id: string
  name: string
  date: string
  type: string
}

export default function LeavePage() {
  const queryClient = useQueryClient()
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['employee-leave-requests'],
    queryFn: async () => {
      const res = await fetch('/api/employee/leave')
      if (!res.ok) throw new Error('Failed to fetch requests')
      return (await res.json()) as LeaveRequest[]
    },
  })

  const { data: holidays = [] } = useQuery({
    queryKey: ['employee-holidays'],
    queryFn: async () => {
      const res = await fetch('/api/employee/holidays?upcoming=1')
      if (!res.ok) return []
      return (await res.json()) as Holiday[]
    },
  })

  const cancelRequest = async (id: string) => {
    setCancellingId(id)
    try {
      const res = await fetch('/api/employee/leave', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'CANCEL' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Cancel failed')
      }
      toast({ title: 'Leave cancelled' })
      void queryClient.invalidateQueries({ queryKey: ['employee-leave-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['leave-balances'] })
      void queryClient.invalidateQueries({ queryKey: ['ess-leave-balances'] })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not cancel',
        variant: 'destructive',
      })
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-1 pb-4 lg:max-w-5xl lg:px-0">
      <div>
        <h1 className="text-xl font-semibold lg:text-2xl">Leave</h1>
        <p className="text-sm text-muted-foreground">
          Balances, requests, and upcoming holidays
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <LeaveBalance />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Upcoming holidays
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {holidays.length === 0 && (
              <p className="text-sm text-muted-foreground">No upcoming holidays</p>
            )}
            {holidays.slice(0, 6).map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <span className="text-sm font-medium">{h.name}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(h.date), 'd MMM yyyy')}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">My requests</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[360px] pr-2">
            <div className="space-y-3">
              {isLoading && (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}
              {!isLoading && requests.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No leave requests yet
                </p>
              )}
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="space-y-2 rounded-xl border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">
                        {format(new Date(request.startDate), 'd MMM')} –{' '}
                        {format(new Date(request.endDate), 'd MMM yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {request.policy?.name || request.type}
                        {request.days ? ` · ${request.days} day(s)` : ''}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {request.reason}
                      </p>
                    </div>
                    <Badge
                      variant={
                        request.status === 'APPROVED'
                          ? 'default'
                          : request.status === 'REJECTED'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {request.status}
                    </Badge>
                  </div>
                  {request.status === 'PENDING' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={cancellingId === request.id}
                      onClick={() => cancelRequest(request.id)}
                    >
                      {cancellingId === request.id ? 'Cancelling…' : 'Cancel request'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
