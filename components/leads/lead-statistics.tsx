'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Award, Target, Users } from 'lucide-react'
import { StatCardsSkeleton } from '@/components/loading'
import { EssErrorState } from '@/components/employee/mobile/ess-states'
import { useCurrency } from '@/hooks/use-currency'

export function LeadStatistics() {
  const { formatCurrency } = useCurrency()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['leadStats'],
    queryFn: async () => {
      const response = await fetch('/api/employee/leads/statistics')
      if (!response.ok) throw new Error('Failed to fetch statistics')
      return response.json()
    }
  })

  if (isLoading) {
    return <StatCardsSkeleton count={3} className="md:grid-cols-3 lg:grid-cols-3" />
  }

  if (isError || !data) {
    return (
      <EssErrorState
        message="We couldn't load your lead numbers."
        onRetry={() => void refetch()}
      />
    )
  }

  const followUps = Array.isArray(data.upcomingFollowUps) ? data.upcomingFollowUps.length : 0
  const conversionRate = Number(data.conversionRate) || 0

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="truncate text-sm font-medium">Active leads</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
        </CardHeader>
        <CardContent>
          <div className="break-words text-xl font-bold tabular-nums sm:text-2xl">{data.activeLeads ?? 0}</div>
          <p className="text-xs text-muted-foreground">
            {followUps} {followUps === 1 ? 'follow-up' : 'follow-ups'} pending
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="truncate text-sm font-medium">Won leads</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" aria-hidden />
        </CardHeader>
        <CardContent>
          <div className="break-words text-xl font-bold tabular-nums sm:text-2xl">{data.wonLeads ?? 0}</div>
          <p className="text-xs text-muted-foreground">
            {conversionRate.toFixed(1)}% conversion rate
          </p>
        </CardContent>
      </Card>

      <Card className="col-span-2 md:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="truncate text-sm font-medium">Total value</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" aria-hidden />
        </CardHeader>
        <CardContent>
          <div className="break-words text-xl font-bold tabular-nums sm:text-2xl">
            {formatCurrency(Number(data.totalValue) || 0)}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
