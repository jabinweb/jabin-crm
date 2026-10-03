'use client'

import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
import {
  EssEmptyState,
  EssErrorState,
  EssListSkeleton,
  humanizeStatus,
} from '@/components/employee/mobile/ess-states'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { confirmAction } from '@/lib/confirm-action'
import { toast } from 'sonner'
import { format } from 'date-fns'

type TeamLeaveRequest = {
  id: string
  startDate: string
  endDate: string
  days: number
  reason: string
  employee: { name: string }
  policy?: { name: string } | null
  type: string
}

class NotManagerError extends Error {}

export default function ManagerTeamLeavePage() {
  const queryClient = useQueryClient()
  const { employeePath } = useWorkspacePaths()
  const {
    data: requests = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['manager-leave'],
    queryFn: async () => {
      const res = await fetch('/api/manager/leave')
      if (res.status === 403) throw new NotManagerError('Not a manager')
      if (!res.ok) throw new Error('Failed')
      return (await res.json()) as TeamLeaveRequest[]
    },
    retry: (count, err) => !(err instanceof NotManagerError) && count < 2,
  })

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      const res = await fetch('/api/manager/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Couldn't update the request")
      }
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.action === 'approve' ? 'Leave approved' : 'Leave rejected')
      void queryClient.invalidateQueries({ queryKey: ['manager-leave'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const reject = async (r: TeamLeaveRequest) => {
    const ok = await confirmAction({
      title: `Reject ${r.employee.name}'s leave?`,
      description: `${format(new Date(r.startDate), 'd MMM')} – ${format(new Date(r.endDate), 'd MMM yyyy')}. They'll see the request as rejected.`,
      confirmLabel: 'Reject leave',
      variant: 'destructive',
    })
    if (ok) actionMutation.mutate({ id: r.id, action: 'reject' })
  }

  const header = (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 h-10">
        <Link href={employeePath('/employee/team')}>
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
          My team
        </Link>
      </Button>
      <EssPageHeader title="Team leave" subtitle="Leave requests waiting for your approval" />
    </>
  )

  if (error instanceof NotManagerError) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
        {header}
        <EssEmptyState
          title="Only managers can approve leave"
          description="This page is for people with direct reports. If you think you should have access, ask your HR admin."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
      {header}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pending</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <EssListSkeleton rows={2} />
          ) : error ? (
            <EssErrorState
              message="We couldn't load your team's leave requests."
              onRetry={() => void refetch()}
            />
          ) : requests.length === 0 ? (
            <EssEmptyState
              icon={CalendarCheck}
              title="You're all caught up"
              description="New leave requests from your team will appear here for approval."
            />
          ) : (
            requests.map((r) => {
              const busy = actionMutation.isPending && actionMutation.variables?.id === r.id
              return (
                <div key={r.id} className="space-y-3 rounded-xl border p-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">{r.employee.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.policy?.name || humanizeStatus(r.type)} · {r.days}{' '}
                      {r.days === 1 ? 'day' : 'days'}
                    </p>
                    <p className="text-xs">
                      {format(new Date(r.startDate), 'd MMM')} –{' '}
                      {format(new Date(r.endDate), 'd MMM yyyy')}
                    </p>
                    {r.reason ? (
                      <p className="break-words text-sm text-muted-foreground">{r.reason}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={busy}
                      onClick={() => actionMutation.mutate({ id: r.id, action: 'approve' })}
                    >
                      {busy && actionMutation.variables?.action === 'approve' ? 'Approving…' : 'Approve'}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={busy}
                      onClick={() => void reject(r)}
                    >
                      {busy && actionMutation.variables?.action === 'reject' ? 'Rejecting…' : 'Reject'}
                    </Button>
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
