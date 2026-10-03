'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** `IN_PROGRESS` -> `In progress`. Never show raw enum values to employees. */
export function humanizeStatus(value?: string | null, fallback = '—') {
  if (!value) return fallback
  const text = value.replace(/[_-]+/g, ' ').trim().toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const POSITIVE = new Set([
  'APPROVED',
  'PAID',
  'REIMBURSED',
  'RESOLVED',
  'CLOSED',
  'COMPLETED',
  'PRESENT',
  'DONE',
  'SUBMITTED',
])
const NEGATIVE = new Set(['REJECTED', 'ABSENT', 'CANCELLED', 'CANCELED', 'WITHDRAWN'])

/** A status badge with a readable label and a consistent colour per meaning. */
export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const key = (status || '').toUpperCase()
  const variant = POSITIVE.has(key) ? 'default' : NEGATIVE.has(key) ? 'destructive' : 'secondary'
  return (
    <Badge variant={variant} className={cn('shrink-0', className)}>
      {humanizeStatus(status)}
    </Badge>
  )
}

/** Placeholder rows for a card list while its data loads. */
export function EssListSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0" />
        </div>
      ))}
    </div>
  )
}

/** Readable load failure with a retry button. */
export function EssErrorState({
  message = 'Something went wrong while loading this.',
  onRetry,
  className,
}: {
  message?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-center',
        className
      )}
    >
      <AlertCircle className="h-5 w-5 text-destructive" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          Try again
        </Button>
      ) : null}
    </div>
  )
}

/** Compact empty state for lists inside ESS cards. */
export function EssEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center',
        className
      )}
    >
      {Icon ? (
        <div className="mb-1 rounded-full bg-muted p-2.5 text-muted-foreground">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      ) : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="max-w-xs text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

/** Shown when the signed-in account has no employee record attached. */
export function NoEmployeeProfile({ what = 'this page' }: { what?: string }) {
  return (
    <EssEmptyState
      title="No employee profile linked"
      description={`Your account isn't linked to an employee record yet, so ${what} is unavailable. Ask your HR admin to link your profile.`}
    />
  )
}
