'use client'

import { useSession } from 'next-auth/react'
import { PayslipCard } from '@/components/employee/payroll/payslip-card'
import { EssPageHeader } from '@/components/employee/mobile/page-header'

export default function PayslipsPage() {
  const { data: session, status } = useSession()

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
      <EssPageHeader title="Payslips" subtitle="View and download your salary statements" />
      {status === 'loading' ? null : (
        <PayslipCard employeeId={session?.user?.employeeId || ''} />
      )}
    </div>
  )
}
