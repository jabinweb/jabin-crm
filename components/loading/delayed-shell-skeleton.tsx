'use client'

import { ShellSkeleton } from '@/components/loading'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'

/** Full-shell skeleton that only appears after a short delay to avoid flash. */
export function DelayedShellSkeleton({ delayMs = 180 }: { delayMs?: number }) {
  const show = useDelayedLoading(true, delayMs)
  if (!show) return null
  return <ShellSkeleton />
}
