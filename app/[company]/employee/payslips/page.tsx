'use client'

import { useSession } from 'next-auth/react'
import { PayslipCard } from '@/components/employee/payroll/payslip-card'

export default function PayslipsPage() {
  const { data: session } = useSession()

  return (
    <div className="mx-auto max-w-lg space-y-4 px-1 pb-4 lg:max-w-2xl lg:px-0">
      <div>
        <h1 className="text-xl font-semibold lg:text-2xl">Payslips</h1>
        <p className="text-sm text-muted-foreground">
          View and download your salary statements
        </p>
      </div>
      <PayslipCard employeeId={session?.user?.employeeId || ''} />
    </div>
  )
}
