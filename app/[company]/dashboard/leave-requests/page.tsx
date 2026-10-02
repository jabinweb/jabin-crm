'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { QueryErrorState, StatusBadge, humanizeEnum } from '@/components/hr/hr-ui'
import { confirmAction } from '@/lib/confirm-action'
import { toast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'
import { CardListSkeleton } from '@/components/loading'

interface LeaveRow {
  id: string
  startDate: string
  endDate: string
  type: string
  reason: string
  status: string
  createdAt: string
  employee: { id: string; name: string; email: string; department: string | null }
}

export default function CompanyLeaveRequestsPage() {
  const params = useParams<{ company: string }>()
  const { data: session, status: sessionStatus } = useSession()
  const companySlug = params.company
  const tenantHeaders = useMemo(
    () => (companySlug ? workspaceSlugHeaders(companySlug) : {}),
    [companySlug]
  )

  const [filter, setFilter] = useState<'PENDING' | 'ALL'>('PENDING')
  const [requests, setRequests] = useState<LeaveRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)

  const canManage =
    session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  const fetchRequests = useCallback(async () => {
    if (!companySlug) return
    setLoading(true)
    setLoadFailed(false)
    try {
      const qs = filter === 'PENDING' ? '?status=PENDING' : ''
      const res = await fetch(`/api/leave-requests${qs}`, { headers: tenantHeaders })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load leave requests')
      setRequests(Array.isArray(data) ? data : [])
    } catch {
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [companySlug, filter, tenantHeaders])

  useEffect(() => {
    if (canManage) fetchRequests()
  }, [canManage, fetchRequests])

  const handleAction = async (req: LeaveRow, action: 'approve' | 'reject') => {
    const id = req.id
    if (action === 'reject') {
      const ok = await confirmAction({
        title: `Reject ${req.employee.name}’s leave?`,
        description: 'They will be notified that the request was rejected.',
        confirmLabel: 'Reject',
        variant: 'destructive',
      })
      if (!ok) return
    }
    setActionId(id)
    try {
      const res = await fetch(`/api/leave-requests/${id}/${action}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...tenantHeaders },
        body: JSON.stringify({ comment: action === 'approve' ? 'Approved' : 'Rejected' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Action failed')
      toast({
        title: action === 'approve' ? 'Leave approved' : 'Leave rejected',
      })
      await fetchRequests()
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Couldn’t update request',
        description: e instanceof Error ? e.message : 'Please try again.',
      })
    } finally {
      setActionId(null)
    }
  }

  if (sessionStatus === 'loading') {
    return <CardListSkeleton rows={4} />
  }

  if (!canManage) {
    return (
      <EmptyState
        icon={Calendar}
        title="Admin access required"
        description="Ask a workspace admin to review leave requests."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Leave requests</h1>
        <p className="text-sm text-muted-foreground">
          Review and approve employee leave for your company.
        </p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as 'PENDING' | 'ALL')}>
        <TabsList>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="ALL">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{filter === 'PENDING' ? 'Pending approval' : 'All requests'}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <CardListSkeleton rows={4} />
          ) : loadFailed ? (
            <QueryErrorState title="Couldn’t load leave requests" onRetry={() => void fetchRequests()} />
          ) : requests.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title={filter === 'PENDING' ? 'You’re all caught up' : 'No leave requests yet'}
              description={
                filter === 'PENDING'
                  ? 'No leave is waiting for approval. Switch to All to see past requests.'
                  : 'Requests employees submit from their portal will appear here.'
              }
              actionLabel={filter === 'PENDING' ? 'Show all requests' : undefined}
              onAction={filter === 'PENDING' ? () => setFilter('ALL') : undefined}
            />
          ) : (
            <div className="space-y-4">
              {requests.map((req) => (
                <div key={req.id} className="space-y-2 rounded-lg border p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{req.employee.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {req.employee.department || req.employee.email}
                      </p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">{humanizeEnum(req.type)}</span>
                    {' · '}
                    {format(new Date(req.startDate), 'd MMM yyyy')} –{' '}
                    {format(new Date(req.endDate), 'd MMM yyyy')}
                  </p>
                  <p className="break-words text-sm text-muted-foreground">{req.reason}</p>
                  {req.status === 'PENDING' && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1 sm:flex-none"
                        disabled={actionId === req.id}
                        onClick={() => void handleAction(req, 'reject')}
                      >
                        Reject
                      </Button>
                      <Button
                        className="flex-1 sm:flex-none"
                        disabled={actionId === req.id}
                        onClick={() => void handleAction(req, 'approve')}
                      >
                        {actionId === req.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
