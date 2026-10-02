'use client'

import { Suspense } from 'react'
import { LeadStatistics } from '@/components/leads/lead-statistics'
import { LeadActivityTimeline } from '@/components/leads/lead-activity-timeline'
import { LeadReminders } from '@/components/leads/lead-reminders'
import { LeadPriorityChart } from '@/components/leads/lead-priority-chart'
import { LeadStatusDistribution } from '@/components/leads/lead-status-distribution'
import { Skeleton } from '@/components/ui/skeleton'

export default function LeadDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Lead Dashboard</h1>
      
      <Suspense fallback={<Skeleton className="h-[120px]" />}>
        <LeadStatistics />
      </Suspense>

      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <Suspense fallback={<Skeleton className="h-[400px]" />}>
          <LeadStatusDistribution />
        </Suspense>
        
        <Suspense fallback={<Skeleton className="h-[400px]" />}>
          <LeadPriorityChart />
        </Suspense>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <Suspense fallback={<Skeleton className="h-[400px]" />}>
          <LeadReminders activities={[]} />
        </Suspense>
        
        <Suspense fallback={<Skeleton className="h-[400px]" />}>
          <LeadActivityTimeline />
        </Suspense>
      </div>
    </div>
  )
}
