'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { ImageUpload } from '@/components/ui/image-upload'

interface EditEmployeeDialogProps {
  employee: {
    id: string
    name: string
    email: string
    phone: string
    jobTitle: string
    department: string
    employmentType: string
    status: string
    avatar?: string | null
    departmentId?: string | null
    designationId?: string | null
    branchId?: string | null
    managerId?: string | null
    address: {
      street: string
      city: string
      state: string
      zipCode: string
      country: string
    }
  }
  onUpdate: (updatedEmployee: EditEmployeeDialogProps['employee'] & Record<string, unknown>) => void
}

type OrgOption = { id: string; name: string }

export function EditEmployeeDialog({ employee, onUpdate }: EditEmployeeDialogProps) {
  const params = useParams<{ company?: string }>()
  const tenantHeaders =
    typeof params?.company === 'string' ? workspaceSlugHeaders(params.company) : {}
  const [formData, setFormData] = useState({
    name: employee.name || '',
    email: employee.email || '',
    phone: employee.phone || '',
    jobTitle: employee.jobTitle || '',
    department: employee.department || '',
    avatar: employee.avatar || '',
    departmentId: employee.departmentId || '',
    designationId: employee.designationId || '',
    branchId: employee.branchId || '',
    managerId: employee.managerId || '',
    address: {
      street: employee.address?.street || '',
      city: employee.address?.city || '',
      state: employee.address?.state || '',
      zipCode: employee.address?.zipCode || '',
      country: employee.address?.country || '',
    },
  })
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [departments, setDepartments] = useState<OrgOption[]>([])
  const [designations, setDesignations] = useState<OrgOption[]>([])
  const [branches, setBranches] = useState<OrgOption[]>([])
  const [managers, setManagers] = useState<OrgOption[]>([])

  useEffect(() => {
    if (!open) return
    void Promise.all([
      fetch('/api/hr/departments').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/hr/designations').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/hr/branches').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/employees', { headers: { ...tenantHeaders } }).then((r) =>
        r.ok ? r.json() : []
      ),
    ]).then(([deps, desigs, brs, emps]) => {
      setDepartments(deps)
      setDesignations(desigs)
      setBranches(brs)
      const list = Array.isArray(emps) ? emps : emps?.data || []
      setManagers(
        list
          .filter((e: { id: string }) => e.id !== employee.id)
          .map((e: { id: string; name: string }) => ({ id: e.id, name: e.name }))
      )
    })
  }, [open, employee.id, tenantHeaders])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...tenantHeaders,
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          jobTitle: formData.jobTitle,
          department: formData.department,
          avatar: formData.avatar,
          address: formData.address,
          employmentType: employee.employmentType,
          status: employee.status,
          departmentId: formData.departmentId || null,
          designationId: formData.designationId || null,
          branchId: formData.branchId || null,
          managerId: formData.managerId || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update employee')
      }

      const updatedEmployee = await response.json()
      onUpdate(updatedEmployee)
      setOpen(false)
      toast({
        title: 'Success',
        description: 'Employee updated successfully',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update employee',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1]
      setFormData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value || '',
        },
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value || '',
      }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Edit Details</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl top-0 translate-y-0 h-full overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Employee Details</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center">
            <ImageUpload
              value={formData.avatar}
              onChange={(url) => {
                setFormData((prev) => ({
                  ...prev,
                  avatar: url,
                }))
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={formData.departmentId || 'none'}
                onValueChange={(v) =>
                  setFormData((p) => ({
                    ...p,
                    departmentId: v === 'none' ? '' : v,
                    department:
                      v === 'none'
                        ? p.department
                        : departments.find((d) => d.id === v)?.name || p.department,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Select
                value={formData.designationId || 'none'}
                onValueChange={(v) =>
                  setFormData((p) => ({
                    ...p,
                    designationId: v === 'none' ? '' : v,
                    jobTitle:
                      v === 'none'
                        ? p.jobTitle
                        : designations.find((d) => d.id === v)?.name || p.jobTitle,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select designation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {designations.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select
                value={formData.branchId || 'none'}
                onValueChange={(v) =>
                  setFormData((p) => ({
                    ...p,
                    branchId: v === 'none' ? '' : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {branches.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Manager</Label>
              <Select
                value={formData.managerId || 'none'}
                onValueChange={(v) =>
                  setFormData((p) => ({
                    ...p,
                    managerId: v === 'none' ? '' : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {managers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                name="jobTitle"
                value={formData.jobTitle}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium">Address</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="street">Street</Label>
                <Input
                  id="street"
                  name="address.street"
                  value={formData.address.street}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="address.city"
                  value={formData.address.city}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  name="address.state"
                  value={formData.address.state}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">Zip Code</Label>
                <Input
                  id="zipCode"
                  name="address.zipCode"
                  value={formData.address.zipCode}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  name="address.country"
                  value={formData.address.country}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
