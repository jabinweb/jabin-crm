'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar } from 'lucide-react'
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
  const { data: session } = useSession()
  const companySlug = params.company
  const tenantHeaders = useMemo(
    () => (companySlug ? workspaceSlugHeaders(companySlug) : {}),
    [companySlug]
  )

  const [filter, setFilter] = useState<'PENDING' | 'ALL'>('PENDING')
  const [requests, setRequests] = useState<LeaveRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  const canManage =
    session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  const fetchRequests = useCallback(async () => {
    if (!companySlug) return
    setLoading(true)
    try {
      const qs = filter === 'PENDING' ? '?status=PENDING' : ''
      const res = await fetch(`/api/leave-requests${qs}`, { headers: tenantHeaders })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load leave requests')
      setRequests(Array.isArray(data) ? data : [])
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e instanceof Error ? e.message : 'Could not load requests',
      })
    } finally {
      setLoading(false)
    }
  }, [companySlug, filter, tenantHeaders])

  useEffect(() => {
    if (canManage) fetchRequests()
  }, [canManage, fetchRequests])

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
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
        title: 'Error',
        description: e instanceof Error ? e.message : 'Could not update request',
      })
    } finally {
      setActionId(null)
    }
  }

  if (!canManage) {
    return <p className="p-6 text-muted-foreground">Admin access required.</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          Leave requests
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
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
          <CardTitle>{filter === 'PENDING' ? 'Pending approval' : 'All requests'}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <CardListSkeleton rows={4} />
          ) : requests.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No leave requests{filter === 'PENDING' ? ' pending approval' : ''}.
            </p>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => (
                <div key={req.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <p className="font-medium">{req.employee.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {req.employee.department || req.employee.email}
                      </p>
                    </div>
                    <Badge
                      variant={
                        req.status === 'APPROVED'
                          ? 'default'
                          : req.status === 'REJECTED'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {req.status}
                    </Badge>
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">{req.type}</span>
                    {' · '}
                    {format(new Date(req.startDate), 'MMM d, yyyy')} –{' '}
                    {format(new Date(req.endDate), 'MMM d, yyyy')}
                  </p>
                  <p className="text-sm text-muted-foreground">{req.reason}</p>
                  {req.status === 'PENDING' && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        disabled={actionId === req.id}
                        onClick={() => handleAction(req.id, 'approve')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionId === req.id}
                        onClick={() => handleAction(req.id, 'reject')}
                      >
                        Reject
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
