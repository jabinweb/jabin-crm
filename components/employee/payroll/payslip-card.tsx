'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { FileDown } from 'lucide-react'
import { CardListSkeleton } from '@/components/loading'

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
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString()
  )
  const [loading, setLoading] = useState(true)

  const fetchPayslips = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/employee/payslips?year=${selectedYear}&employeeId=${employeeId}`
      )
      if (!response.ok) throw new Error('Failed to fetch payslips')
      const data = await response.json()
      setPayslips(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedYear, employeeId])

  useEffect(() => {
    void fetchPayslips()
  }, [fetchPayslips])

  const getMonthName = (month: number) => {
    return new Date(0, month - 1).toLocaleString('default', { month: 'long' })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const years = Array.from({ length: 5 }, (_, i) =>
    (new Date().getFullYear() - i).toString()
  )

  return (
    <Card className="border-0 shadow-none lg:border lg:shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-0 pb-3 lg:px-6">
        <CardTitle className="text-base">Statements</CardTitle>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[100px]">
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
        {loading ? (
          <CardListSkeleton rows={3} className="py-4" />
        ) : payslips.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed py-12 text-sm text-muted-foreground">
            No payslips for {selectedYear}
          </div>
        ) : (
          <div className="space-y-3">
            {payslips.map((payslip) => (
              <div
                key={payslip.id}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">
                      {getMonthName(payslip.month)} {payslip.year}
                    </p>
                    <Badge variant={payslip.isPaid ? 'default' : 'secondary'}>
                      {payslip.isPaid ? 'Paid' : 'Pending'}
                    </Badge>
                  </div>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatCurrency(payslip.netSalary)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Basic {formatCurrency(payslip.basicSalary)}
                    {payslip.isPaid && payslip.paidAt
                      ? ` · Paid ${new Date(payslip.paidAt).toLocaleDateString()}`
                      : ''}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() =>
                    window.open(
                      `/api/employee/payslips/${payslip.id}/download`,
                      '_blank'
                    )
                  }
                >
                  <FileDown className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
