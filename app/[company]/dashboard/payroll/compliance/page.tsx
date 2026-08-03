'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function PayrollCompliancePage() {
  const now = new Date()
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [form16Emp, setForm16Emp] = useState('')
  const [form16, setForm16] = useState<null | {
    employee: { name: string; employeeId: string; pan?: string | null }
    summary: Record<string, number>
  }>(null)

  const { data } = useQuery({
    queryKey: ['compliance', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/hr/compliance?month=${month}&year=${year}`)
      if (!res.ok) throw new Error('Failed')
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

  const download = (format: string) => {
    window.open(`/api/hr/compliance?month=${month}&year=${year}&format=${format}`, '_blank')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payroll compliance</h1>
        <p className="text-sm text-muted-foreground">
          PF/ESI registers, bank advice, Form 16 summary.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Period</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label>Month</Label>
            <Input value={month} onChange={(e) => setMonth(e.target.value)} type="number" />
          </div>
          <div className="space-y-1">
            <Label>Year</Label>
            <Input value={year} onChange={(e) => setYear(e.target.value)} type="number" />
          </div>
          <Button variant="outline" onClick={() => download('bank-csv')}>
            Bank advice CSV
          </Button>
          <Button variant="outline" onClick={() => download('pf-csv')}>
            PF register CSV
          </Button>
          <Button variant="outline" onClick={() => download('esi-csv')}>
            ESI register CSV
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Register ({data?.payslips?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.payslips || []).map((p) => (
            <div key={p.id} className="flex justify-between gap-2 border rounded-lg p-3 text-sm">
              <div>
                <p className="font-medium">
                  {p.employee.name}{' '}
                  <span className="text-muted-foreground">({p.employee.employeeId})</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  PF {p.breakdown?.components?.deductions?.pf ?? '—'} · ESI{' '}
                  {p.breakdown?.components?.deductions?.esi ?? '—'} · PT{' '}
                  {p.breakdown?.components?.deductions?.pt ?? '—'} · TDS{' '}
                  {p.breakdown?.components?.deductions?.tax ?? '—'}
                </p>
              </div>
              <p className="font-medium">₹{p.netSalary.toLocaleString('en-IN')}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Form 16 summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label>Employee internal id</Label>
              <Input value={form16Emp} onChange={(e) => setForm16Emp(e.target.value)} />
            </div>
            <Button
              onClick={async () => {
                const res = await fetch(
                  `/api/hr/compliance/form16?employeeId=${form16Emp}&year=${year}`
                )
                if (!res.ok) {
                  toast.error('Failed')
                  return
                }
                setForm16(await res.json())
              }}
            >
              Load
            </Button>
          </div>
          {form16 && (
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p className="font-medium">
                {form16.employee.name} ({form16.employee.employeeId}) · PAN{' '}
                {form16.employee.pan || '—'}
              </p>
              <p>Gross: ₹{form16.summary.gross?.toLocaleString('en-IN')}</p>
              <p>PF: ₹{form16.summary.pf?.toLocaleString('en-IN')}</p>
              <p>ESI: ₹{form16.summary.esi?.toLocaleString('en-IN')}</p>
              <p>PT: ₹{form16.summary.pt?.toLocaleString('en-IN')}</p>
              <p>TDS: ₹{form16.summary.tds?.toLocaleString('en-IN')}</p>
              <p>Net: ₹{form16.summary.net?.toLocaleString('en-IN')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
