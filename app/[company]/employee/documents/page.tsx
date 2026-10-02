'use client'

import { useSession } from 'next-auth/react'
import { EmployeeDigitalFile } from '@/components/hr/employee-digital-file'
import { EssPageHeader } from '@/components/employee/mobile/page-header'

export default function EmployeeDocumentsPage() {
  const { data: session } = useSession()
  const employeeId = session?.user?.employeeId

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
      <EssPageHeader title="My documents" subtitle="Your digital file" />
      {employeeId ? (
        <EmployeeDigitalFile employeeId={employeeId} />
      ) : (
        <p className="text-sm text-muted-foreground">No employee profile linked.</p>
      )}
    </div>
  )
}
