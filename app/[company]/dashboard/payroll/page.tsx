'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Wallet } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'

interface PayslipRow {
  id: string
  month: number
  year: number
  netSalary: number
  isPaid: boolean
  paidAt: string | null
  employee: { id: string; name: string; email: string }
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export default function CompanyPayrollPage() {
  const params = useParams<{ company: string }>()
  const { data: session } = useSession()
  const companySlug = params.company
  const tenantHeaders = useMemo(
    () => (companySlug ? workspaceSlugHeaders(companySlug) : {}),
    [companySlug]
  )

  const now = new Date()
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [payslips, setPayslips] = useState<PayslipRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const canManage =
    session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  const fetchPayslips = useCallback(async () => {
    if (!companySlug) return
    setLoading(true)
    try {
      const qs = new URLSearchParams({ month, year })
      const res = await fetch(`/api/payrolls?${qs}`, { headers: tenantHeaders })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load payslips')
      setPayslips(Array.isArray(data) ? data : [])
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e instanceof Error ? e.message : 'Could not load payroll',
      })
    } finally {
      setLoading(false)
    }
  }, [companySlug, month, year, tenantHeaders])

  useEffect(() => {
    if (canManage) fetchPayslips()
  }, [canManage, fetchPayslips])

  const handleGenerate = async () => {
    if (!companySlug) return
    setGenerating(true)
    try {
      const ctxRes = await fetch('/api/dashboard/settings', { headers: tenantHeaders })
      const ctx = await ctxRes.json()
      const companyId = ctx?.company?.id
      if (!companyId) throw new Error('Company not found')

      const res = await fetch('/api/payrolls/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...tenantHeaders },
        body: JSON.stringify({
          companyId,
          month: parseInt(month, 10),
          year: parseInt(year, 10),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.details || 'Generate failed')
      toast({
        title: 'Payslips generated',
        description: data.message || `Created ${data.data?.length ?? 0} payslips`,
      })
      await fetchPayslips()
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Generation failed',
        description: e instanceof Error ? e.message : 'Could not generate payslips',
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleInitiatePayment = async (payslipId: string) => {
    setProcessingId(payslipId)
    try {
      const res = await fetch('/api/payrolls/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...tenantHeaders },
        body: JSON.stringify({ payslipId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Payment failed')
      toast({
        title: 'Razorpay order created',
        description: data.message || 'Payslip updates when payment.captured webhook runs.',
      })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e instanceof Error ? e.message : 'Could not initiate payment',
      })
    } finally {
      setProcessingId(null)
    }
  }

  const handleMarkPaidStaging = async (payslipId: string) => {
    setProcessingId(payslipId)
    try {
      const res = await fetch(`/api/payrolls/${payslipId}/mark-paid`, {
        method: 'POST',
        headers: { ...tenantHeaders },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not mark paid')
      toast({ title: 'Payslip marked paid' })
      await fetchPayslips()
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e instanceof Error ? e.message : 'Mark paid failed',
      })
    } finally {
      setProcessingId(null)
    }
  }

  if (!canManage) {
    return <p className="p-6 text-muted-foreground">Admin access required.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Payroll
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate payslips, initiate Razorpay payment, or mark paid via webhook. In staging,
            set <code className="text-xs">ALLOW_MANUAL_PAYROLL_MARK_PAID=true</code> to mark paid
            without Razorpay.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[120px]">
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
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2].map((offset) => {
                const y = String(now.getFullYear() - offset)
                return (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate payslips
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {MONTHS[parseInt(month, 10) - 1]} {year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : payslips.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No payslips for this period. Generate payslips for active employees with salary configured.
            </p>
          ) : (
            <div className="space-y-3">
              {payslips.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border rounded-lg p-4"
                >
                  <div>
                    <p className="font-medium">{p.employee.name}</p>
                    <p className="text-sm text-muted-foreground">{p.employee.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      ₹{p.netSalary.toLocaleString('en-IN')}
                    </span>
                    <Badge variant={p.isPaid ? 'default' : 'secondary'}>
                      {p.isPaid ? 'Paid' : 'Unpaid'}
                    </Badge>
                    {!p.isPaid && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processingId === p.id}
                          onClick={() => handleInitiatePayment(p.id)}
                        >
                          {processingId === p.id && (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          )}
                          Pay via Razorpay
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={processingId === p.id}
                          onClick={() => handleMarkPaidStaging(p.id)}
                        >
                          Mark paid
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
