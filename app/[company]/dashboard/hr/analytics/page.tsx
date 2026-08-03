'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function HrAnalyticsPage() {
  const { data } = useQuery({
    queryKey: ['hr-analytics'],
    queryFn: async () => {
      const res = await fetch('/api/hr/analytics')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{
        headcount: number
        active: number
        attritionApprox: number
        attendancePunchesThisMonth: number
        leavePending: number
        leaveUtilization: number
        payrollCostThisMonth: number
        openHrTickets: number
      }>
    },
  })

  const tiles = [
    { label: 'Headcount', value: data?.headcount },
    { label: 'Active', value: data?.active },
    {
      label: 'Attrition (term/total)',
      value: data ? `${(data.attritionApprox * 100).toFixed(1)}%` : '—',
    },
    { label: 'Attendance punches (mo)', value: data?.attendancePunchesThisMonth },
    { label: 'Leave pending', value: data?.leavePending },
    {
      label: 'Leave utilization',
      value: data ? `${(data.leaveUtilization * 100).toFixed(1)}%` : '—',
    },
    {
      label: 'Payroll cost (mo)',
      value: data ? `₹${data.payrollCostThisMonth.toLocaleString('en-IN')}` : '—',
    },
    { label: 'Open HR tickets', value: data?.openHrTickets },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">HR analytics</h1>
        <p className="text-sm text-muted-foreground">Operational snapshot for People ops.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{t.value ?? '—'}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
