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
import { CardListSkeleton } from '@/components/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { QueryErrorState } from '@/components/hr/hr-ui'
import { confirmAction } from '@/lib/confirm-action'
import { useCurrency } from '@/hooks/use-currency'

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
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function CompanyPayrollPage() {
  const params = useParams<{ company: string }>()
  const { data: session, status: sessionStatus } = useSession()
  const { formatCurrency } = useCurrency()
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
  const [loadFailed, setLoadFailed] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const canManage =
    session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  const fetchPayslips = useCallback(async () => {
    if (!companySlug) return
    setLoading(true)
    setLoadFailed(false)
    try {
      const qs = new URLSearchParams({ month, year })
      const res = await fetch(`/api/payrolls?${qs}`, { headers: tenantHeaders })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load payslips')
      setPayslips(Array.isArray(data) ? data : [])
    } catch {
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [companySlug, month, year, tenantHeaders])

  useEffect(() => {
    if (canManage) fetchPayslips()
  }, [canManage, fetchPayslips])

  const periodLabel = `${MONTHS[parseInt(month, 10) - 1]} ${year}`

  const handleGenerate = async () => {
    if (!companySlug) return
    const ok = await confirmAction({
      title: `Generate payslips for ${periodLabel}?`,
      description: 'Creates payslips for every active employee with a salary structure.',
      confirmLabel: 'Generate payslips',
    })
    if (!ok) return
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

  const handleInitiatePayment = async (p: PayslipRow) => {
    const payslipId = p.id
    const ok = await confirmAction({
      title: `Pay ${p.employee.name}?`,
      description: `Starts a Razorpay payment of ${formatCurrency(p.netSalary, 'INR')}. The payslip is marked paid once the payment is confirmed.`,
      confirmLabel: 'Start payment',
    })
    if (!ok) return
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
        title: 'Payment started',
        description: 'The payslip will show as paid once Razorpay confirms the payment.',
      })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Couldn’t start payment',
        description: e instanceof Error ? e.message : 'Please try again.',
      })
    } finally {
      setProcessingId(null)
    }
  }

  const handleMarkPaidStaging = async (p: PayslipRow) => {
    const payslipId = p.id
    const ok = await confirmAction({
      title: `Mark ${p.employee.name}’s payslip as paid?`,
      description: 'Use this only if the salary was paid outside Opslane.',
      confirmLabel: 'Mark paid',
    })
    if (!ok) return
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
        title: 'Couldn’t mark as paid',
        description: e instanceof Error ? e.message : 'Please try again.',
      })
    } finally {
      setProcessingId(null)
    }
  }

  if (sessionStatus === 'loading') {
    return <CardListSkeleton rows={5} />
  }

  if (!canManage) {
    return (
      <EmptyState
        icon={Wallet}
        title="Admin access required"
        description="Ask a workspace admin to run payroll."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
          <p className="text-sm text-muted-foreground">
            Generate monthly payslips, then pay through Razorpay or mark them paid.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[136px]" aria-label="Month">
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
            <SelectTrigger className="w-[100px]" aria-label="Year">
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
          <CardTitle className="text-base">{periodLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <CardListSkeleton rows={5} />
          ) : loadFailed ? (
            <QueryErrorState title="Couldn’t load payslips" onRetry={() => void fetchPayslips()} />
          ) : payslips.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title={`No payslips for ${periodLabel}`}
              description="Generate payslips for active employees who have a salary structure on their profile."
              actionLabel="Generate payslips"
              onAction={() => void handleGenerate()}
            />
          ) : (
            <div className="space-y-3">
              {payslips.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border rounded-lg p-3 sm:p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.employee.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{p.employee.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(p.netSalary, 'INR')}
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
                          onClick={() => void handleInitiatePayment(p)}
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
                          onClick={() => void handleMarkPaidStaging(p)}
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
