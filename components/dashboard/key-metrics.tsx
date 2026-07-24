'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight, Target, Users, CheckCircle2, Clock } from "lucide-react"
import { StatCardsSkeleton } from "@/components/loading"
import type { DashboardStats } from "@/types/dashboard"

interface KeyMetricsProps {
  data?: DashboardStats
  isLoading?: boolean
}

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
}

function MetricCard({ title, value, change, icon }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <p className={`text-xs ${change >= 0 ? 'text-green-500' : 'text-red-500'} flex items-center`}>
            {change >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {Math.abs(change)}% from last month
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function KeyMetrics({ data, isLoading }: KeyMetricsProps) {
  if (isLoading) {
    return <StatCardsSkeleton count={4} />
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Leads"
        value={data?.totalLeads || 0}
        change={data?.leadsChange}
        icon={<Users className="h-4 w-4" />}
      />
      <MetricCard
        title="Conversion Rate"
        value={`${data?.conversionRate || 0}%`}
        change={data?.conversionChange}
        icon={<Target className="h-4 w-4" />}
      />
      <MetricCard
        title="Tasks Completed"
        value={data?.completedTasks || 0}
        icon={<CheckCircle2 className="h-4 w-4" />}
      />
      <MetricCard
        title="Pending Follow-ups"
        value={data?.pendingFollowUps || 0}
        icon={<Clock className="h-4 w-4" />}
      />
    </div>
  )
}
