'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * App-style page header for every employee-portal page.
 * Pages wrap it in a `space-y-*` root, so it carries no bottom margin of its own.
 */
export function EssPageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">{title}</h1>
        {subtitle ? (
          <p className="break-words text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
