'use client'
import "@/types/auth"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { workspaceSlugHeaders } from "@/lib/api/workspace-slug"

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
  const tenantHeaders = workspaceSlug ? workspaceSlugHeaders(workspaceSlug) : {}

  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const canApprove =
    session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    if (status === "loading") return
    if (!canApprove) {
      router.push('/auth/signin')
      return
    }
    fetchPendingEmployees()
  }, [status, canApprove, router])

  const fetchPendingEmployees = async () => {
    try {
      const response = await fetch('/api/pending/employee', { headers: tenantHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch')
      setEmployees(Array.isArray(data) ? data : data.employees ?? [])
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch pending employees",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateEmployee = async (id: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch('/api/pending/employee', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...tenantHeaders },
        body: JSON.stringify({ id, action }),
      })
      if (!response.ok) throw new Error('Failed to update employee')
      setEmployees(prev => prev.filter(emp => emp.id !== id))
      toast({
        title: action === 'approve' ? 'Employee approved' : 'Registration rejected',
      })
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update employee",
      })
    }
  }

  if (isLoading) {
    return <div className="p-6">Loading pending registrations…</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Approve employees</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Review registration requests for your workspace.
      </p>
      {employees.length === 0 ? (
        <p>No pending employees.</p>
      ) : (
        <ul className="space-y-3">
          {employees.map(emp => (
            <li key={emp.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border rounded-lg p-4">
              <div>
                <p className="font-medium">{emp.name}</p>
                <p className="text-sm text-muted-foreground">{emp.email}</p>
                <p className="text-xs text-muted-foreground">Company: {emp.company.name}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => updateEmployee(emp.id, 'reject')}>
                  Reject
                </Button>
                <Button onClick={() => updateEmployee(emp.id, 'approve')}>
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
