'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { LeaveBalance } from '@/components/employee/leave/leave-balance'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
import {
  EssEmptyState,
  EssErrorState,
  EssListSkeleton,
  StatusBadge,
  humanizeStatus,
} from '@/components/employee/mobile/ess-states'
import { confirmAction } from '@/lib/confirm-action'
import { format } from 'date-fns'
import { CalendarDays, Plane } from 'lucide-react'

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

function dateRange(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  if (format(s, 'yyyy-MM-dd') === format(e, 'yyyy-MM-dd')) return format(s, 'd MMM yyyy')
  return `${format(s, 'd MMM')} – ${format(e, 'd MMM yyyy')}`
}

export default function LeavePage() {
  const queryClient = useQueryClient()
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const {
    data: requests = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['employee-leave-requests'],
    queryFn: async () => {
      const res = await fetch('/api/employee/leave')
      if (!res.ok) throw new Error('Failed to fetch requests')
      return (await res.json()) as LeaveRequest[]
    },
  })

  const { data: holidays = [], isLoading: holidaysLoading } = useQuery({
    queryKey: ['employee-holidays'],
    queryFn: async () => {
      const res = await fetch('/api/employee/holidays?upcoming=1')
      if (!res.ok) return []
      return (await res.json()) as Holiday[]
    },
  })

  const cancelRequest = async (request: LeaveRequest) => {
    const ok = await confirmAction({
      title: 'Cancel this leave request?',
      description: `Your request for ${dateRange(request.startDate, request.endDate)} will be withdrawn and the days returned to your balance.`,
      confirmLabel: 'Cancel request',
      cancelLabel: 'Keep it',
      variant: 'destructive',
    })
    if (!ok) return
    setCancellingId(request.id)
    try {
      const res = await fetch('/api/employee/leave', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: request.id, action: 'CANCEL' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Couldn't cancel the request")
      }
      toast({ title: 'Leave request cancelled' })
      void queryClient.invalidateQueries({ queryKey: ['employee-leave-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['leave-balances'] })
      void queryClient.invalidateQueries({ queryKey: ['ess-leave-balances'] })
    } catch (error) {
      toast({
        title: "Couldn't cancel the request",
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 lg:mx-0 lg:max-w-5xl">
      <EssPageHeader title="Leave" subtitle="Balances, requests and upcoming holidays" />

      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <LeaveBalance />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" aria-hidden />
              Upcoming holidays
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {holidaysLoading ? (
              <EssListSkeleton rows={3} />
            ) : holidays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming holidays on the calendar.</p>
            ) : (
              holidays.slice(0, 6).map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{h.name}</p>
                    {h.type ? (
                      <p className="text-xs text-muted-foreground">{humanizeStatus(h.type)}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(new Date(h.date), 'EEE, d MMM')}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">My requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <EssListSkeleton rows={3} />
          ) : isError ? (
            <EssErrorState
              message="We couldn't load your leave requests."
              onRetry={() => void refetch()}
            />
          ) : requests.length === 0 ? (
            <EssEmptyState
              icon={Plane}
              title="No leave requests yet"
              description="Use “Request leave” above to apply. Your requests and their approval status show up here."
            />
          ) : (
            requests.map((request) => (
              <div key={request.id} className="space-y-2 rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {dateRange(request.startDate, request.endDate)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {request.policy?.name || humanizeStatus(request.type)}
                      {request.days
                        ? ` · ${request.days} ${request.days === 1 ? 'day' : 'days'}`
                        : ''}
                    </p>
                    {request.reason ? (
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {request.reason}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={request.status} />
                </div>
                {request.status === 'PENDING' && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={cancellingId === request.id}
                    onClick={() => void cancelRequest(request)}
                  >
                    {cancellingId === request.id ? 'Cancelling…' : 'Cancel request'}
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
