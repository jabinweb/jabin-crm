'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { PieChart as PieChartIcon } from "lucide-react"
import { LeadStatus } from "@prisma/client"
import { SectionSkeleton } from "@/components/loading"
import {
  EssEmptyState,
  EssErrorState,
  humanizeStatus,
} from "@/components/employee/mobile/ess-states"

const COLORS: Record<LeadStatus, string> = {
  NEW: "#60a5fa",
  CONTACTED: "#818cf8",
  RESPONDED: "#a78bfa",
  QUALIFIED: "#34d399",
  PROPOSAL: "#fbbf24",
  NEGOTIATION: "#f97316",
  WON: "#22c55e",
  CONVERTED: "#14b8a6",
  LOST: "#ef4444",
  ON_HOLD: "#94a3b8",
  UNSUBSCRIBED: "#64748b",
}

export function LeadStatusDistribution() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['leadStatusDistribution'],
    queryFn: async () => {
      const response = await fetch('/api/employee/leads/status-distribution')
      if (!response.ok) throw new Error('Failed to fetch status distribution')
      return response.json() as Promise<Record<string, number>>
    }
  })

  const chartData = Object.entries(data ?? {})
    .filter(([, count]) => Number(count) > 0)
    .map(([status, count]) => ({
      name: humanizeStatus(status),
      value: Number(count),
      color: COLORS[status as LeadStatus] ?? "#94a3b8",
    }))

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">Leads by status</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SectionSkeleton lines={8} className="h-[300px] py-8" />
        ) : isError ? (
          <EssErrorState
            message="We couldn't load the status breakdown."
            onRetry={() => void refetch()}
          />
        ) : chartData.length === 0 ? (
          <EssEmptyState
            icon={PieChartIcon}
            title="No leads yet"
            description="Once you have leads, you'll see how they're spread across stages."
          />
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius="45%"
                  outerRadius="75%"
                  paddingAngle={1}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
