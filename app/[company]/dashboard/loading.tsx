'use client'

import { PageHeaderSkeleton, SectionSkeleton, StatCardsSkeleton } from '@/components/loading'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'

export default function DashboardLoading() {
  const show = useDelayedLoading(true, 180)
  if (!show) return null
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <SectionSkeleton lines={8} />
    </div>
  )
}
