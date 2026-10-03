'use client'

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Megaphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  EssEmptyState,
  EssErrorState,
  EssListSkeleton,
} from '@/components/employee/mobile/ess-states'

interface Announcement {
  id: string
  title: string
  content: string
  priority: number
  createdAt: string
}

interface AnnouncementsCardProps {
  companyId: number
}

const PRIORITY: Record<number, { label: string; variant: 'secondary' | 'default' | 'destructive' }> = {
  0: { label: 'Low', variant: 'secondary' },
  1: { label: 'Medium', variant: 'default' },
  2: { label: 'High', variant: 'destructive' },
}

/** Full list of company announcements for the employee portal (page scrolls, no nested scroller). */
export function AnnouncementsCard({ companyId }: AnnouncementsCardProps) {
  const { data: announcements = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['employee-announcements', companyId],
    queryFn: async () => {
      const response = await fetch(`/api/employee/announcements?companyId=${companyId}`)
      if (!response.ok) throw new Error('Failed to fetch announcements')
      return (await response.json()) as Announcement[]
    },
  })

  if (isLoading) return <EssListSkeleton rows={4} />

  if (isError) {
    return (
      <EssErrorState
        message="We couldn't load announcements."
        onRetry={() => void refetch()}
      />
    )
  }

  if (announcements.length === 0) {
    return (
      <EssEmptyState
        icon={Megaphone}
        title="No announcements yet"
        description="Company updates from HR and management will show up here."
      />
    )
  }

  return (
    <div className="space-y-3">
      {announcements.map((announcement) => {
        const priority = PRIORITY[announcement.priority] ?? PRIORITY[0]
        return (
          <Card key={announcement.id} className="shadow-none">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="min-w-0 break-words font-medium">{announcement.title}</h2>
                <Badge className="shrink-0" variant={priority.variant}>
                  {priority.label}
                </Badge>
              </div>
              <p className="whitespace-pre-line break-words text-sm text-muted-foreground">
                {announcement.content}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(announcement.createdAt), 'd MMM yyyy')}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
