'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** "IN_PROGRESS" -> "In progress", "PAID_LEAVE" -> "Paid leave". */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return '—'
  const s = value.replace(/[_-]+/g, ' ').trim().toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const POSITIVE = new Set([
  'APPROVED',
  'RESOLVED',
  'CLOSED',
  'PAID',
  'COMPLETED',
  'DONE',
  'ACTIVE',
  'PRESENT',
  'HIRED',
  'ISSUED',
  'PROCESSED',
  'FINALIZED',
])
const NEGATIVE = new Set(['REJECTED', 'CANCELLED', 'CANCELED', 'ABSENT', 'FAILED', 'TERMINATED'])

/** Status pill with a humanised label; tone carries meaning but the text always does too. */
export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const key = (status || '').toUpperCase()
  const variant = NEGATIVE.has(key) ? 'destructive' : POSITIVE.has(key) ? 'default' : 'secondary'
  return (
    <Badge variant={variant} className={cn('shrink-0 whitespace-nowrap', className)}>
      {humanizeEnum(status)}
    </Badge>
  )
}

/** Readable load-failure state with a retry action. */
export function QueryErrorState({
  title = 'Couldn’t load this list',
  description = 'Check your connection and try again.',
  onRetry,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}
    >
      <div className="mb-3 rounded-full bg-destructive/10 p-3 text-destructive">
        <AlertCircle className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw className="mr-2 h-4 w-4" aria-hidden />
          Try again
        </Button>
      ) : null}
    </div>
  )
}

/** Throw an Error carrying the API's `error` message when present. */
export async function ensureOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return
  const body = await res.json().catch(() => ({}) as { error?: string })
  throw new Error((body as { error?: string }).error || fallback)
}

/** Value that only updates after `delayMs` without changes (for search-as-you-type). */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}
