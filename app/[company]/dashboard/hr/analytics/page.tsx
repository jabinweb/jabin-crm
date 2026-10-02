'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { QueryErrorState } from '@/components/hr/hr-ui'
import { useCurrency } from '@/hooks/use-currency'

type Analytics = {
  headcount: number
  active: number
  attritionApprox: number
  attendancePunchesThisMonth: number
  leavePending: number
  leaveUtilization: number
  payrollCostThisMonth: number
  openHrTickets: number
}

export default function HrAnalyticsPage() {
  const { formatCurrency } = useCurrency()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['hr-analytics'],
    queryFn: async () => {
      const res = await fetch('/api/hr/analytics')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<Analytics>
    },
  })

  const pct = (n: number | undefined) => (n == null ? '—' : `${(n * 100).toFixed(1)}%`)

  const tiles: { label: string; hint: string; value: string | number | undefined }[] = [
    { label: 'Headcount', hint: 'All employee records', value: data?.headcount },
    { label: 'Active', hint: 'Currently employed', value: data?.active },
    { label: 'Attrition', hint: 'Terminated ÷ total headcount', value: pct(data?.attritionApprox) },
    { label: 'Attendance this month', hint: 'Present or late days recorded', value: data?.attendancePunchesThisMonth },
    { label: 'Leave awaiting approval', hint: 'Pending requests', value: data?.leavePending },
    { label: 'Leave utilisation', hint: 'Days used ÷ entitled this year', value: pct(data?.leaveUtilization) },
    {
      label: 'Payroll cost this month',
      hint: 'Net pay on generated payslips',
      value: data ? formatCurrency(data.payrollCostThisMonth, 'INR') : undefined,
    },
    { label: 'Open HR tickets', hint: 'Not yet picked up', value: data?.openHrTickets },
  ]

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">HR analytics</h1>
        <p className="text-sm text-muted-foreground">
          A snapshot of headcount, attendance, leave and payroll.
        </p>
      </div>
      {isError ? (
        <QueryErrorState
          title="Couldn’t load HR analytics"
          onRetry={() => void refetch()}
          className="rounded-lg border"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {tiles.map((t) => (
            <Card key={t.label} className="min-w-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium leading-snug text-muted-foreground">
                  {t.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <p className="truncate text-xl font-semibold tabular-nums sm:text-2xl">
                    {t.value ?? '—'}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{t.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
