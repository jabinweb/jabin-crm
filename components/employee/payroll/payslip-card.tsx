'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileDown, Wallet } from 'lucide-react'
import { CardListSkeleton } from '@/components/loading'
import {
  EssEmptyState,
  EssErrorState,
  NoEmployeeProfile,
} from '@/components/employee/mobile/ess-states'
import { useCurrency } from '@/hooks/use-currency'

interface PayslipCardProps {
  employeeId: string
}

interface Payslip {
  id: string
  month: number
  year: number
  basicSalary: number
  deductions: number
  additions: number
  netSalary: number
  isPaid: boolean
  paidAt: string | null
}

export function PayslipCard({ employeeId }: PayslipCardProps) {
  const { formatCurrency } = useCurrency()
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())

  const { data: payslips = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['employee-payslips', employeeId, selectedYear],
    enabled: Boolean(employeeId),
    queryFn: async () => {
      const response = await fetch(
        `/api/employee/payslips?year=${selectedYear}&employeeId=${employeeId}`
      )
      if (!response.ok) throw new Error('Failed to fetch payslips')
      return (await response.json()) as Payslip[]
    },
  })

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString())

  if (!employeeId) return <NoEmployeeProfile what="your payslips" />

  return (
    <Card className="border-0 shadow-none lg:border lg:shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-0 pb-3 lg:px-6">
        <CardTitle className="text-base">Statements</CardTitle>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="h-10 w-[110px]" aria-label="Year">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-0 lg:px-6">
        {isLoading ? (
          <CardListSkeleton rows={3} className="py-4" />
        ) : isError ? (
          <EssErrorState
            message="We couldn't load your payslips."
            onRetry={() => void refetch()}
          />
        ) : payslips.length === 0 ? (
          <EssEmptyState
            icon={Wallet}
            title={`No payslips for ${selectedYear}`}
            description="Payslips appear here once payroll is processed. Try another year, or contact HR if one is missing."
          />
        ) : (
          <div className="space-y-3">
            {payslips.map((payslip) => {
              const period = format(new Date(payslip.year, payslip.month - 1, 1), 'MMMM yyyy')
              return (
                <div
                  key={payslip.id}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{period}</p>
                      <Badge variant={payslip.isPaid ? 'default' : 'secondary'} className="shrink-0">
                        {payslip.isPaid ? 'Paid' : 'Pending'}
                      </Badge>
                    </div>
                    <p className="text-lg font-semibold tabular-nums">
                      {formatCurrency(Number(payslip.netSalary) || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Net pay · Basic {formatCurrency(Number(payslip.basicSalary) || 0)}
                      {payslip.isPaid && payslip.paidAt
                        ? ` · Paid ${format(new Date(payslip.paidAt), 'd MMM yyyy')}`
                        : ''}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    aria-label={`Download payslip for ${period}`}
                    title="Download PDF"
                    onClick={() =>
                      window.open(`/api/employee/payslips/${payslip.id}/download`, '_blank')
                    }
                  >
                    <FileDown className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
