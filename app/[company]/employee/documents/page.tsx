'use client'

import { useSession } from 'next-auth/react'
import { EmployeeDigitalFile } from '@/components/hr/employee-digital-file'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
import { NoEmployeeProfile } from '@/components/employee/mobile/ess-states'

export default function EmployeeDocumentsPage() {
  const { data: session, status } = useSession()
  const employeeId = session?.user?.employeeId

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
      <EssPageHeader title="My documents" subtitle="Documents and records HR keeps on file for you" />
      {status === 'loading' ? null : employeeId ? (
        <EmployeeDigitalFile employeeId={employeeId} />
      ) : (
        <NoEmployeeProfile what="your document file" />
      )}
    </div>
  )
}
