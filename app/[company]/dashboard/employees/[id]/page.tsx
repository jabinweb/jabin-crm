'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams } from 'next/navigation'
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  Clock,
  Building,
  UserCircle,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'
import { EditEmployeeDialog } from './edit-employee-dialog'
import { toast } from '@/hooks/use-toast'
import { SalaryForm } from '@/components/employee/payroll/salary-form'
import { EmployeeData, EmploymentType, EmployeeStatus } from '@/types/employee'
import { DetailSkeleton } from '@/components/loading'

type AddressShape = {
  street?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
}

function asAddress(value: unknown): AddressShape | null {
  if (!value || typeof value !== 'object') return null
  return value as AddressShape
}

export default function EmployeePage() {
  const { data: session, status } = useSession()
  const { id, company: companySlug } = useParams() as { id: string; company: string }
  const { path } = useWorkspacePaths()
  const tenantHeaders = useMemo(
    () => (companySlug ? workspaceSlugHeaders(companySlug) : {}),
    [companySlug]
  )
  const listHref = path('/dashboard/employees')

  const [employee, setEmployee] = useState<EmployeeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!id) {
      setLoading(false)
      setError('Missing employee id')
      return
    }

    let mounted = true
    async function fetchEmployee() {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/employees/${id}`, {
          headers: { ...tenantHeaders },
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(
            typeof data.error === 'string' ? data.error : 'Failed to fetch employee'
          )
        }
        if (!mounted) return
        setEmployee(data)
      } catch (err) {
        if (!mounted) return
        const message = err instanceof Error ? err.message : 'Failed to fetch employee details'
        setError(message)
        setEmployee(null)
        toast({
          variant: 'destructive',
          title: 'Error',
          description: message,
        })
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchEmployee()
    return () => {
      mounted = false
    }
  }, [id, status, tenantHeaders])

  const handleStatusUpdate = async (
    field: 'status' | 'employmentType',
    value: EmployeeStatus | EmploymentType
  ) => {
    if (!employee) return

    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...tenantHeaders },
        body: JSON.stringify({
          [field]: value,
        }),
      })

      if (!response.ok) throw new Error('Failed to update employee')

      const updatedEmployee = await response.json()
      setEmployee(updatedEmployee)
      toast({
        title: 'Success',
        description: 'Employee status updated successfully',
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update employee',
      })
    }
  }

  if (status === 'loading' || loading) {
    return <DetailSkeleton />
  }

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <h3 className="text-xl font-semibold">Sign in required</h3>
        <Link href="/auth/signin" className="text-blue-600 hover:underline">
          Sign in
        </Link>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <h3 className="text-xl font-semibold">Employee not found</h3>
        {error && <p className="text-sm text-muted-foreground">{error}</p>}
        <Link href={listHref} className="text-blue-600 hover:underline">
          Back to Employees
        </Link>
      </div>
    )
  }

  const address = asAddress(employee.address)

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={listHref}
          className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Employees
        </Link>
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{employee.name}</h1>
            <p className="text-muted-foreground">{employee.jobTitle}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? 'Done' : 'Edit Status'}
            </Button>
            <EditEmployeeDialog
              employee={employee}
              onUpdate={(updatedEmployee) => setEmployee(updatedEmployee)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center">
                  <UserCircle className="h-5 w-5 text-muted-foreground mr-3" />
                  <div>
                    <p className="text-sm text-muted-foreground">Full Name</p>
                    <p className="font-medium">{employee.name}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Mail className="h-5 w-5 text-muted-foreground mr-3" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{employee.email}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Phone className="h-5 w-5 text-muted-foreground mr-3" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{employee.phone || '—'}</p>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-start">
                  <MapPin className="h-5 w-5 text-muted-foreground mr-3 mt-1" />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Address</p>
                    {address ? (
                      <>
                        {address.street && <p className="font-medium">{address.street}</p>}
                        <p className="font-medium">
                          {[address.city, address.state, address.zipCode]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                        {address.country && (
                          <p className="font-medium">{address.country}</p>
                        )}
                      </>
                    ) : (
                      <p className="font-medium text-muted-foreground">No address on file</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Employment Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center">
                  <Briefcase className="h-5 w-5 text-muted-foreground mr-3" />
                  <div>
                    <p className="text-sm text-muted-foreground">Job Title</p>
                    <p className="font-medium">{employee.jobTitle || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Building className="h-5 w-5 text-muted-foreground mr-3" />
                  <div>
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="font-medium">{employee.department || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-muted-foreground mr-3" />
                  <div>
                    <p className="text-sm text-muted-foreground">Date Joined</p>
                    <p className="font-medium">
                      {employee.dateJoined
                        ? new Date(employee.dateJoined).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <SalaryForm employeeId={id} initialData={employee.salary} />
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Status</h2>
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Employment Type</p>
                {isEditing ? (
                  <Select
                    value={employee.employmentType}
                    onValueChange={(value) =>
                      handleStatusUpdate('employmentType', value as EmploymentType)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(EmploymentType).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className="text-sm">
                    {employee.employmentType?.replace(/_/g, ' ') || '—'}
                  </Badge>
                )}
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground mb-2">Current Status</p>
                {isEditing ? (
                  <Select
                    value={employee.status}
                    onValueChange={(value) =>
                      handleStatusUpdate('status', value as EmployeeStatus)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(EmployeeStatus).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge
                    className={
                      employee.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : employee.status === 'ON_LEAVE'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }
                  >
                    {employee.status?.replace(/_/g, ' ') || '—'}
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start" disabled>
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled>
                <Clock className="h-4 w-4 mr-2" />
                View Time Logs
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled>
                <AlertCircle className="h-4 w-4 mr-2" />
                Report Issue
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
