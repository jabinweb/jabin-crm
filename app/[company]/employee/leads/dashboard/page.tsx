'use client'

import { LeadStatistics } from '@/components/leads/lead-statistics'
import { LeadActivityTimeline } from '@/components/leads/lead-activity-timeline'
import { LeadPriorityChart } from '@/components/leads/lead-priority-chart'
import { LeadStatusDistribution } from '@/components/leads/lead-status-distribution'

export default function LeadDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lead dashboard</h1>
        <p className="text-sm text-muted-foreground">
          How your assigned leads are moving through the pipeline
        </p>
      </div>

      <LeadStatistics />

      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <LeadStatusDistribution />
        <LeadPriorityChart />
      </div>

      <LeadActivityTimeline />
    </div>
  )
}
