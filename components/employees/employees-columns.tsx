'use client'

import { EmployeeStatus } from '@prisma/client'
import { ColumnDef, Row } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/user-avatar'
import Link from 'next/link'
import { ActionButtons } from '@/components/ui/action-buttons'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { humanizeEnum } from '@/components/hr/hr-ui'
import { confirmAction } from '@/lib/confirm-action'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

export type Employee = {
  id: string
  name: string
  email: string
  phone: string
  department: string
  dateJoined: string
  status: EmployeeStatus
  avatar?: string | null
}

export const employeeStatusColors: Record<EmployeeStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  ON_LEAVE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300',
  PENDING: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  SUSPENDED: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  TERMINATED: 'bg-muted text-muted-foreground',
  SABBATICAL: 'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300',
  MEDICAL_LEAVE: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  MATERNITY_LEAVE: 'bg-pink-100 text-pink-800 dark:bg-pink-500/15 dark:text-pink-300',
}

/** Badge classes for an employee status (border-less tinted pill that works in dark mode). */
export function employeeStatusClass(status: string): string {
  return cn(
    'border-transparent',
    employeeStatusColors[status as EmployeeStatus] ?? 'bg-muted text-muted-foreground'
  )
}

function EmployeeNameCell({ employee }: { employee: Employee }) {
  const { path } = useWorkspacePaths()
  return (
    <div className="flex items-center gap-3">
      <UserAvatar person={employee} size="md" />
      <Link
        href={path(`/dashboard/employees/${employee.id}`)}
        className="font-medium text-primary hover:underline"
      >
        {employee.name}
      </Link>
    </div>
  )
}

export const columns: ColumnDef<Employee>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => <EmployeeNameCell employee={row.original} />,
  },
  {
    accessorKey: 'department',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
    enableColumnFilter: true,
    enableSorting: true,
    filterFn: (row, id, filterValues: string[]) => {
      const value = row.getValue(id) as string
      return filterValues.length === 0 ? true : filterValues.includes(value)
    },
  },
  {
    id: 'contact',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Contact" />,
    enableSorting: false,
    cell: ({ row }) => {
      const employee = row.original
      if (!employee) return null

      return (
        <div className="flex flex-col">
          <span>{employee.phone}</span>
          <span className="text-sm text-muted-foreground">{employee.email}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    enableColumnFilter: true,
    enableSorting: true,
    filterFn: (row, id, filterValues: string[]) => {
      const value = row.getValue(id) as string
      return filterValues.length === 0 ? true : filterValues.includes(value)
    },
    cell: ({ row }) => {
      const status = row.original.status

      if (!status) {
        return <Badge variant="outline">Unknown</Badge>
      }

      return (
        <Badge className={employeeStatusClass(status)}>{humanizeEnum(status)}</Badge>
      )
    },
  },
  {
    accessorKey: 'dateJoined',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Hire Date" />,
    enableSorting: true,
    cell: ({ row }) => {
      const date = row.original.dateJoined
      if (!date) return null

      return format(new Date(date), 'd MMM yyyy')
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const employee = row.original
      return employee ? <RowActions row={row} /> : null
    },
  },
]

function RowActions({ row }: { row: Row<Employee> }) {
  const router = useRouter()
  const { path, workspaceFetch } = useWorkspacePaths()
  const employee = row.original

  const handleDelete = async () => {
    if (!employee?.id) return
    const ok = await confirmAction({
      title: `Delete ${employee.name}?`,
      description: 'This permanently removes the employee record. This can’t be undone.',
      confirmLabel: 'Delete employee',
      variant: 'destructive',
    })
    if (!ok) return

    try {
      const response = await workspaceFetch(`/api/employees/${employee.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete employee')
      }

      toast({
        title: 'Employee deleted',
      })

      window.location.assign(path('/dashboard/employees'))
    } catch (error) {
      console.error('Delete employee error:', error)
      toast({
        variant: 'destructive',
        title: 'Couldn’t delete employee',
        description: 'Please try again.',
      })
    }
  }

  if (!employee) return null

  return (
    <ActionButtons
      onEdit={() => router.push(path(`/dashboard/employees/${employee.id}`))}
      onDelete={handleDelete}
    />
  )
}
