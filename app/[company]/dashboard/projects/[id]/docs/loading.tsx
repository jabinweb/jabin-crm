'use client'

import { DetailSkeleton } from '@/components/loading'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'

export default function Loading() {
  const show = useDelayedLoading(true, 180)
  if (!show) return null
  return <DetailSkeleton />
}
