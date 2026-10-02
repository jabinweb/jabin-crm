'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { CardListSkeleton } from '@/components/loading'
import { QueryErrorState, ensureOk } from '@/components/hr/hr-ui'
import { useCurrency } from '@/hooks/use-currency'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

type Form16 = {
  employee: { name: string; employeeId: string; pan?: string | null }
  summary: Record<string, number>
}

export default function PayrollCompliancePage() {
  const now = new Date()
  const { path } = useWorkspacePaths()
  const { formatCurrency } = useCurrency()
  // Statutory registers are Indian payroll — always rupees.
  const inr = (n: number | null | undefined) => (n == null ? '—' : formatCurrency(n, 'INR'))
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [form16Emp, setForm16Emp] = useState('')
  const [form16, setForm16] = useState<Form16 | null>(null)
  const years = [0, 1, 2].map((o) => String(now.getFullYear() - o))

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['compliance', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/hr/compliance?month=${month}&year=${year}`)
      await ensureOk(res, 'Failed to load register')
      return res.json() as Promise<{
        payslips: Array<{
          id: string
          netSalary: number
          basicSalary: number
          deductions: number
          employee: { name: string; employeeId: string }
          breakdown?: {
            components?: { deductions?: { pf?: number; esi?: number; pt?: number; tax?: number } }
          }
        }>
      }>
    },
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-directory-pick'],
    queryFn: async () => {
      const res = await fetch('/api/hr/directory')
      if (!res.ok) return []
      return (await res.json()) as { id: string; name: string; employeeId: string }[]
    },
  })

  const loadForm16 = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/hr/compliance/form16?employeeId=${encodeURIComponent(form16Emp)}&year=${year}`
      )
      await ensureOk(res, 'Couldn’t load the Form 16 summary')
      return (await res.json()) as Form16
    },
    onSuccess: (d) => setForm16(d),
    onError: (e: Error) => toast.error(e.message),
  })

  const download = (format: string) => {
    window.open(`/api/hr/compliance?month=${month}&year=${year}&format=${format}`, '_blank')
  }

  const payslips = data?.payslips || []
  const periodLabel = `${MONTHS[Number(month) - 1]} ${year}`

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Payroll compliance</h1>
        <p className="text-sm text-muted-foreground">
          PF and ESI registers, bank advice and Form 16 summaries.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="comp-month">Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger id="comp-month" className="sm:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((label, i) => (
                    <SelectItem key={label} value={String(i + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="comp-year">Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger id="comp-year" className="sm:w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="outline" onClick={() => download('bank-csv')}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Bank advice (CSV)
            </Button>
            <Button variant="outline" onClick={() => download('pf-csv')}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              PF register (CSV)
            </Button>
            <Button variant="outline" onClick={() => download('esi-csv')}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              ESI register (CSV)
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Register · {periodLabel}
            {!isLoading && !isError ? ` (${payslips.length})` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <CardListSkeleton rows={3} />
          ) : isError ? (
            <QueryErrorState title="Couldn’t load the register" onRetry={() => void refetch()} />
          ) : payslips.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title={`No payslips for ${periodLabel}`}
              description="Generate payslips for this month on the Payroll page first."
              actionLabel="Go to payroll"
              actionHref={path('/dashboard/payroll')}
            />
          ) : (
            payslips.map((p) => {
              const d = p.breakdown?.components?.deductions
              return (
                <div key={p.id} className="flex justify-between gap-2 rounded-lg border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="break-words font-medium">
                      {p.employee.name}{' '}
                      <span className="text-muted-foreground">({p.employee.employeeId})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PF {inr(d?.pf)} · ESI {inr(d?.esi)} · PT {inr(d?.pt)} · TDS {inr(d?.tax)}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium tabular-nums">{inr(p.netSalary)}</p>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Form 16 summary</CardTitle>
          <CardDescription>Yearly totals for one employee for {year}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              if (form16Emp && !loadForm16.isPending) loadForm16.mutate()
            }}
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="f16-emp">Employee</Label>
              <Select value={form16Emp} onValueChange={(v) => { setForm16Emp(v); setForm16(null) }}>
                <SelectTrigger id="f16-emp">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} ({e.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={!form16Emp || loadForm16.isPending}>
              {loadForm16.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Show summary
            </Button>
          </form>
          {form16 && (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <p className="break-words font-medium">
                {form16.employee.name} ({form16.employee.employeeId}) · PAN{' '}
                {form16.employee.pan || 'not on file'}
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                {(
                  [
                    ['Gross', 'gross'],
                    ['PF', 'pf'],
                    ['ESI', 'esi'],
                    ['Professional tax', 'pt'],
                    ['TDS', 'tds'],
                    ['Net', 'net'],
                  ] as const
                ).map(([label, key]) => (
                  <div key={key} className="flex justify-between gap-2 sm:block">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium tabular-nums">{inr(form16.summary[key])}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
