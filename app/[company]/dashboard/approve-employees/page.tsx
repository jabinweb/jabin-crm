'use client'
import "@/types/auth"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { CardListSkeleton } from "@/components/loading"
import { QueryErrorState } from "@/components/hr/hr-ui"
import { confirmAction } from "@/lib/confirm-action"
import { toast } from "@/hooks/use-toast"
import { workspaceSlugHeaders } from "@/lib/api/workspace-slug"
import { Loader2, UserCheck } from "lucide-react"

interface Employee {
  id: string
  name: string
  email: string
  company: {
    name: string
  }
}

export default function ApproveEmployeesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams<{ company?: string }>()
  const workspaceSlug = typeof params?.company === 'string' ? params.company : undefined
  const tenantHeaders = useMemo(
    () => (workspaceSlug ? workspaceSlugHeaders(workspaceSlug) : {}),
    [workspaceSlug]
  )

  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const canApprove =
    session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  const fetchPendingEmployees = useCallback(async () => {
    setIsLoading(true)
    setLoadFailed(false)
    try {
      const response = await fetch('/api/pending/employee', { headers: tenantHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch')
      setEmployees(Array.isArray(data) ? data : data.employees ?? [])
    } catch {
      setLoadFailed(true)
    } finally {
      setIsLoading(false)
    }
  }, [tenantHeaders])

  useEffect(() => {
    if (status === "loading") return
    if (!canApprove) {
      router.push('/auth/signin')
      return
    }
    void fetchPendingEmployees()
  }, [status, canApprove, router, fetchPendingEmployees])

  const updateEmployee = async (emp: Employee, action: 'approve' | 'reject') => {
    if (action === 'reject') {
      const ok = await confirmAction({
        title: 'Reject this registration?',
        description: `${emp.name} (${emp.email}) will not be able to join the workspace.`,
        confirmLabel: 'Reject',
        variant: 'destructive',
      })
      if (!ok) return
    }
    setBusyId(emp.id)
    try {
      const response = await fetch('/api/pending/employee', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...tenantHeaders },
        body: JSON.stringify({ id: emp.id, action }),
      })
      if (!response.ok) throw new Error('Failed to update employee')
      setEmployees(prev => prev.filter(e => e.id !== emp.id))
      toast({
        title: action === 'approve' ? 'Employee approved' : 'Registration rejected',
      })
    } catch {
      toast({
        variant: "destructive",
        title: "Couldn’t update registration",
        description: "Please try again.",
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Approve employees</h1>
        <p className="text-sm text-muted-foreground">
          Review registration requests for your workspace.
        </p>
      </div>
      {isLoading ? (
        <CardListSkeleton rows={3} />
      ) : loadFailed ? (
        <QueryErrorState
          title="Couldn’t load pending registrations"
          onRetry={() => void fetchPendingEmployees()}
          className="rounded-lg border"
        />
      ) : employees.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No pending registrations"
          description="When someone signs up to join this workspace, their request will appear here for approval."
          className="rounded-lg border"
        />
      ) : (
        <ul className="space-y-3">
          {employees.map(emp => (
            <li key={emp.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{emp.name}</p>
                <p className="break-all text-sm text-muted-foreground">{emp.email}</p>
                <p className="text-xs text-muted-foreground">Company: {emp.company.name}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  disabled={busyId === emp.id}
                  onClick={() => void updateEmployee(emp, 'reject')}
                >
                  Reject
                </Button>
                <Button
                  className="flex-1 sm:flex-none"
                  disabled={busyId === emp.id}
                  onClick={() => void updateEmployee(emp, 'approve')}
                >
                  {busyId === emp.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Approve
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
