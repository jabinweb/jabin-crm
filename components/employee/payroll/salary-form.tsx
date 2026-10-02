'use client'

import { useState, useEffect, useMemo, type FormEvent } from 'react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useCurrency } from '@/hooks/use-currency'
import type { SalaryStructure } from '@/types/salary'

interface SalaryFormProps {
  employeeId: string;
  onSuccess?: () => void
  initialData?: Partial<SalaryStructure>
}

type FieldKey = keyof SalaryStructure

const EARNINGS: { key: FieldKey; label: string }[] = [
  { key: 'basicSalary', label: 'Basic salary' },
  { key: 'houseRent', label: 'House rent allowance' },
  { key: 'transport', label: 'Transport allowance' },
  { key: 'medicalAllowance', label: 'Medical allowance' },
]
const DEDUCTIONS: { key: FieldKey; label: string }[] = [
  { key: 'taxDeduction', label: 'Tax deduction' },
  { key: 'otherDeductions', label: 'Other deductions' },
]

type FormState = Record<FieldKey, string>

const toForm = (d?: Partial<SalaryStructure> | null): FormState => ({
  basicSalary: d?.basicSalary ? String(d.basicSalary) : '',
  houseRent: d?.houseRent ? String(d.houseRent) : '',
  transport: d?.transport ? String(d.transport) : '',
  medicalAllowance: d?.medicalAllowance ? String(d.medicalAllowance) : '',
  taxDeduction: d?.taxDeduction ? String(d.taxDeduction) : '',
  otherDeductions: d?.otherDeductions ? String(d.otherDeductions) : '',
})

const num = (v: string) => (v.trim() === '' ? 0 : Number(v))

export function SalaryForm({ employeeId, onSuccess, initialData }: SalaryFormProps) {
  const params = useParams<{ company?: string }>()
  const company = typeof params?.company === 'string' ? params.company : undefined
  // Memoized: a fresh object each render would re-run the fetch effect in a loop.
  const tenantHeaders = useMemo(
    () => (company ? workspaceSlugHeaders(company) : {}),
    [company]
  )
  const { toast } = useToast()
  const { formatCurrency } = useCurrency()
  const [isSaving, setIsSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormState>(() => toForm(initialData))
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchCurrentSalary() {
      try {
        const res = await fetch(`/api/employees/${employeeId}/salary`, {
          headers: { ...tenantHeaders },
        })
        if (res.ok) {
          const data = await res.json()
          if (data && !cancelled) {
            setFormData(toForm(data))
            setEffectiveFrom(data.effectiveFrom ?? null)
          }
        }
      } catch (error) {
        console.error('Error fetching salary:', error)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    fetchCurrentSalary()
    return () => {
      cancelled = true
    }
  }, [employeeId, tenantHeaders])

  const values: SalaryStructure = {
    basicSalary: num(formData.basicSalary),
    houseRent: num(formData.houseRent),
    transport: num(formData.transport),
    medicalAllowance: num(formData.medicalAllowance),
    taxDeduction: num(formData.taxDeduction),
    otherDeductions: num(formData.otherDeductions),
  }
  const invalidAmount = Object.values(values).some((n) => !Number.isFinite(n) || n < 0)
  const basicMissing = !(values.basicSalary > 0)
  const gross = values.basicSalary + values.houseRent + values.transport + values.medicalAllowance
  const net = gross - values.taxDeduction - values.otherDeductions

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (basicMissing || invalidAmount || isSaving) return
    try {
      setIsSaving(true)
      const res = await fetch(`/api/employees/${employeeId}/salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...tenantHeaders },
        body: JSON.stringify(values)
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update salary')
      }
      const saved = await res.json().catch(() => null)
      setEffectiveFrom(saved?.effectiveFrom ?? new Date().toISOString())
      setSubmitted(false)
      toast({ title: "Salary structure saved" })
      onSuccess?.()
    } catch (error) {
      toast({
        title: "Couldn’t save salary",
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const renderField = ({ key, label }: { key: FieldKey; label: string }) => {
    const id = `salary-${key}`
    const showError = key === 'basicSalary' && submitted && basicMissing
    return (
      <div key={key} className="grid gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          placeholder="0"
          value={formData[key]}
          onChange={(e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }))}
          disabled={isSaving}
          aria-invalid={showError || undefined}
        />
        {showError && <p className="text-xs text-destructive">Enter a basic salary above zero.</p>}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Salary structure</CardTitle>
        <CardDescription>
          Monthly amounts. Saving creates a new revision effective today.
          {effectiveFrom ? ` Current revision since ${format(new Date(effectiveFrom), 'd MMM yyyy')}.` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Earnings</legend>
              <div className="grid gap-4 sm:grid-cols-2">{EARNINGS.map(renderField)}</div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Deductions</legend>
              <div className="grid gap-4 sm:grid-cols-2">{DEDUCTIONS.map(renderField)}</div>
            </fieldset>
            <div className="flex flex-wrap justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
              <span>
                Gross <span className="font-medium">{formatCurrency(gross)}</span>
              </span>
              <span>
                Net <span className="font-medium">{formatCurrency(net)}</span>
              </span>
            </div>
            {invalidAmount && (
              <p className="text-xs text-destructive">Amounts can’t be negative.</p>
            )}
            <Button type="submit" className="w-full sm:w-auto" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save salary
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
