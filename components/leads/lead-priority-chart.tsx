'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { BarChart, Cell, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { BarChart3 } from "lucide-react"
import { SectionSkeleton } from "@/components/loading"
import {
  EssEmptyState,
  EssErrorState,
  humanizeStatus,
} from "@/components/employee/mobile/ess-states"

const COLORS = {
  LOW: '#60a5fa',
  MEDIUM: '#fbbf24',
  HIGH: '#f97316',
  URGENT: '#ef4444'
}

export function LeadPriorityChart() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['leadPriorityDistribution'],
    queryFn: async () => {
      const response = await fetch('/api/employee/leads/priority-distribution')
      if (!response.ok) throw new Error('Failed to fetch priority distribution')
      return response.json() as Promise<Record<string, number>>
    }
  })

  const chartData = Object.entries(data ?? {}).map(([priority, count]) => ({
    name: humanizeStatus(priority),
    count: Number(count) || 0,
    color: COLORS[priority as keyof typeof COLORS] ?? '#94a3b8',
  }))
  const hasLeads = chartData.some((d) => d.count > 0)

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">Leads by priority</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SectionSkeleton lines={8} className="h-[300px] py-8" />
        ) : isError ? (
          <EssErrorState
            message="We couldn't load the priority breakdown."
            onRetry={() => void refetch()}
          />
        ) : !hasLeads ? (
          <EssEmptyState
            icon={BarChart3}
            title="No leads yet"
            description="Once you have leads, you'll see how many are high priority."
          />
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Leads" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
