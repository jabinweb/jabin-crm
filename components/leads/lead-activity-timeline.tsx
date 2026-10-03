'use client'

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Activity, RefreshCw } from "lucide-react"
import {
  EssEmptyState,
  EssErrorState,
  EssListSkeleton,
  humanizeStatus,
} from "@/components/employee/mobile/ess-states"
import { cn } from "@/lib/utils"

type ActivityRow = {
  id: string
  type: string
  description: string
  createdAt: string
}

export function LeadActivityTimeline() {
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['leadActivities'],
    queryFn: async () => {
      const response = await fetch('/api/employee/leads/activities')
      if (!response.ok) throw new Error('Failed to fetch activities')
      return response.json()
    }
  })

  const activities: ActivityRow[] = Array.isArray(data) ? data : data?.activities ?? []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Recent activity</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          aria-label="Refresh activity"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <EssListSkeleton rows={3} />
        ) : isError ? (
          <EssErrorState
            message="We couldn't load recent activity."
            onRetry={() => void refetch()}
          />
        ) : activities.length === 0 ? (
          <EssEmptyState
            icon={Activity}
            title="No activity yet"
            description="Calls, emails and notes you log on your leads will show up here."
          />
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <Badge variant="outline" className="shrink-0">
                  {humanizeStatus(activity.type)}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
