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
  Building,
  UserCircle,
  ChevronLeft,
  Loader2,
  Plus,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { humanizeEnum } from '@/components/hr/hr-ui'
import { employeeStatusClass } from '@/components/employees/employees-columns'
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
import { EmployeeDigitalFile } from '@/components/hr/employee-digital-file'

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

function CustomFieldsEditor({
  employeeId,
  initial,
  headers,
  onSaved,
}: {
  employeeId: string
  initial?: Record<string, string> | null
  headers: HeadersInit
  onSaved: (fields: Record<string, string>) => void
}) {
  const [rows, setRows] = useState<{ key: string; value: string }[]>(() => {
    const entries = Object.entries(initial && typeof initial === 'object' ? initial : {})
    return entries.length
      ? entries.map(([key, value]) => ({ key, value: String(value ?? '') }))
      : [{ key: '', value: '' }]
  })
  const [saving, setSaving] = useState(false)

  const keys = rows.map((r) => r.key.trim()).filter(Boolean)
  const hasDuplicate = new Set(keys).size !== keys.length

  const save = async () => {
    if (hasDuplicate || saving) return
    const customFields: Record<string, string> = {}
    for (const r of rows) {
      if (r.key.trim()) customFields[r.key.trim()] = r.value
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ customFields }),
      })
      if (!res.ok) throw new Error('Failed')
      onSaved(customFields)
      toast({ title: 'Custom fields saved' })
    } catch {
      toast({ variant: 'destructive', title: 'Couldn’t save custom fields', description: 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Extra details your team tracks, such as blood group or T-shirt size.
      </p>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <Input
            aria-label={`Field ${i + 1} name`}
            placeholder="Field name"
            value={row.key}
            onChange={(e) =>
              setRows((prev) => prev.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))
            }
          />
          <Input
            aria-label={`Field ${i + 1} value`}
            placeholder="Value"
            value={row.value}
            onChange={(e) =>
              setRows((prev) => prev.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            aria-label={`Remove field ${row.key || i + 1}`}
            onClick={() =>
              setRows((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [{ key: '', value: '' }]))
            }
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {hasDuplicate && <p className="text-xs text-destructive">Each field name must be unique.</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setRows((prev) => [...prev, { key: '', value: '' }])}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add field
        </Button>
        <Button type="button" onClick={() => void save()} disabled={saving || hasDuplicate}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save fields
        </Button>
      </div>
    </div>
  )
}

function StatutoryEditor({
  employeeId,
  headers,
}: {
  employeeId: string
  headers: HeadersInit
}) {
  const [pan, setPan] = useState('')
  const [uan, setUan] = useState('')
  const [pfNumber, setPfNumber] = useState('')
  const [esiNumber, setEsiNumber] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/hr/statutory?employeeId=${employeeId}`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) {
          if (!cancelled) setLoaded(true)
          return
        }
        setPan(d.pan || '')
        setUan(d.uan || '')
        setPfNumber(d.pfNumber || '')
        setEsiNumber(d.esiNumber || '')
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [employeeId, headers])

  const [saving, setSaving] = useState(false)

  if (!loaded) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  const fields: { id: string; label: string; value: string; set: (v: string) => void; hint: string }[] = [
    { id: 'pan', label: 'PAN', value: pan, set: (v) => setPan(v.toUpperCase()), hint: 'ABCDE1234F' },
    { id: 'uan', label: 'UAN', value: uan, set: setUan, hint: '12-digit UAN' },
    { id: 'pf', label: 'PF number', value: pfNumber, set: setPfNumber, hint: 'PF account number' },
    { id: 'esi', label: 'ESI number', value: esiNumber, set: setEsiNumber, hint: 'ESI IP number' },
  ]

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (saving) return
        setSaving(true)
        try {
          const res = await fetch('/api/hr/statutory', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ employeeId, pan, uan, pfNumber, esiNumber }),
          })
          if (!res.ok) toast({ variant: 'destructive', title: 'Couldn’t save statutory details' })
          else toast({ title: 'Statutory details saved' })
        } finally {
          setSaving(false)
        }
      }}
    >
      {fields.map((f) => (
        <div key={f.id} className="space-y-2">
          <Label htmlFor={`statutory-${f.id}`}>{f.label}</Label>
          <Input
            id={`statutory-${f.id}`}
            placeholder={f.hint}
            value={f.value}
            autoComplete="off"
            onChange={(e) => f.set(e.target.value)}
          />
        </div>
      ))}
      <Button type="submit" className="w-full sm:col-span-2 sm:w-auto sm:justify-self-start" disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save statutory details
      </Button>
    </form>
  )
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
  const [reloadKey, setReloadKey] = useState(0)

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
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchEmployee()
    return () => {
      mounted = false
    }
  }, [id, status, tenantHeaders, reloadKey])

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
        title: field === 'status' ? 'Status updated' : 'Employment type updated',
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Couldn’t update employee',
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    }
  }

  if (status === 'loading' || loading) {
    return <DetailSkeleton />
  }

  if (!session?.user) {
    return (
      <EmptyState
        icon={UserCircle}
        title="Sign in required"
        description="Sign in to view employee profiles."
        actionLabel="Sign in"
        actionHref="/auth/signin"
        className="min-h-[40vh]"
      />
    )
  }

  if (!employee) {
    const notFound = /not found/i.test(error ?? '')
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-muted p-3 text-muted-foreground">
          <UserCircle className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold">
            {notFound ? 'Employee not found' : 'Couldn’t load this employee'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {notFound
              ? 'They may have been removed, or the link is out of date.'
              : 'Check your connection and try again.'}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {!notFound && (
            <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </Button>
          )}
          <Button asChild>
            <Link href={listHref}>Back to employees</Link>
          </Button>
        </div>
      </div>
    )
  }

  const address = asAddress(employee.address)

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={listHref}
          className="mb-4 inline-flex min-h-[2.5rem] items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to employees
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-tight">{employee.name}</h1>
            <p className="text-muted-foreground">{employee.jobTitle}</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? 'Done' : 'Change status'}
            </Button>
            <EditEmployeeDialog
              employee={employee}
              onUpdate={(updatedEmployee) =>
                setEmployee((prev) =>
                  prev
                    ? ({ ...prev, ...updatedEmployee } as EmployeeData)
                    : (updatedEmployee as unknown as EmployeeData)
                )
              }
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card className="p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-4">Personal information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex min-w-0 items-center">
                  <UserCircle className="h-5 w-5 shrink-0 text-muted-foreground mr-3" />
                  <div>
                    <p className="text-sm text-muted-foreground">Full name</p>
                    <p className="font-medium">{employee.name}</p>
                  </div>
                </div>
                <div className="flex min-w-0 items-center">
                  <Mail className="h-5 w-5 shrink-0 text-muted-foreground mr-3" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="break-all font-medium">{employee.email}</p>
                  </div>
                </div>
                <div className="flex min-w-0 items-center">
                  <Phone className="h-5 w-5 shrink-0 text-muted-foreground mr-3" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{employee.phone || '—'}</p>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex min-w-0 items-start">
                  <MapPin className="h-5 w-5 shrink-0 text-muted-foreground mr-3 mt-1" />
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

          <Card className="p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-4">Employment details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex min-w-0 items-center">
                  <Briefcase className="h-5 w-5 shrink-0 text-muted-foreground mr-3" />
                  <div>
                    <p className="text-sm text-muted-foreground">Job title</p>
                    <p className="font-medium">{employee.jobTitle || '—'}</p>
                  </div>
                </div>
                <div className="flex min-w-0 items-center">
                  <Building className="h-5 w-5 shrink-0 text-muted-foreground mr-3" />
                  <div>
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="font-medium">{employee.department || '—'}</p>
                  </div>
                </div>
                <div className="flex min-w-0 items-center">
                  <Calendar className="h-5 w-5 shrink-0 text-muted-foreground mr-3" />
                  <div>
                    <p className="text-sm text-muted-foreground">Date joined</p>
                    <p className="font-medium">
                      {employee.dateJoined
                        ? format(new Date(employee.dateJoined), 'd MMMM yyyy')
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <EmployeeDigitalFile employeeId={id} companySlug={companySlug} />

          <Card className="space-y-4 p-4 sm:p-6">
            <h2 className="text-lg font-semibold">Custom fields</h2>
            <CustomFieldsEditor
              employeeId={id}
              initial={(employee as { customFields?: Record<string, string> | null }).customFields}
              headers={tenantHeaders}
              onSaved={(fields) =>
                setEmployee((prev) => (prev ? { ...prev, customFields: fields } as EmployeeData : prev))
              }
            />
          </Card>

          <Card className="space-y-4 p-4 sm:p-6">
            <h2 className="text-lg font-semibold">India statutory</h2>
            <StatutoryEditor employeeId={id} headers={tenantHeaders} />
          </Card>

          <SalaryForm employeeId={id} initialData={employee.salary} />
        </div>

        <div className="space-y-6">
          <Card className="p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-4">Status</h2>
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Employment type</p>
                {isEditing ? (
                  <Select
                    value={employee.employmentType}
                    onValueChange={(value) =>
                      handleStatusUpdate('employmentType', value as EmploymentType)
                    }
                  >
                    <SelectTrigger className="w-full" aria-label="Employment type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(EmploymentType).map((type) => (
                        <SelectItem key={type} value={type}>
                          {humanizeEnum(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className="text-sm">
                    {humanizeEnum(employee.employmentType)}
                  </Badge>
                )}
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground mb-2">Current status</p>
                {isEditing ? (
                  <Select
                    value={employee.status}
                    onValueChange={(value) =>
                      handleStatusUpdate('status', value as EmployeeStatus)
                    }
                  >
                    <SelectTrigger className="w-full" aria-label="Employee status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(EmployeeStatus).map((s) => (
                        <SelectItem key={s} value={s}>
                          {humanizeEnum(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={employeeStatusClass(employee.status ?? '')}>
                    {humanizeEnum(employee.status)}
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-4">Contact</h2>
            <div className="space-y-3">
              <Button asChild variant="outline" className="w-full justify-start">
                <a href={`mailto:${employee.email}`}>
                  <Mail className="h-4 w-4 mr-2" />
                  Send email
                </a>
              </Button>
              {employee.phone ? (
                <Button asChild variant="outline" className="w-full justify-start">
                  <a href={`tel:${employee.phone}`}>
                    <Phone className="h-4 w-4 mr-2" />
                    Call {employee.phone}
                  </a>
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
