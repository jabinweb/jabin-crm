'use client'

import { SectionSkeleton, StatCardsSkeleton } from '@/components/loading'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'

// Shown while the next page loads. It cannot know that page's title, so it shows
// content placeholders only — never a fake heading.
export default function DashboardLoading() {
  const show = useDelayedLoading(true, 180)
  if (!show) return null
  return (
    <div className="space-y-6">
      <StatCardsSkeleton />
      <SectionSkeleton lines={8} />
    </div>
  )
}
