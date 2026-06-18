'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ActivityType } from '@/types/lead';
import { type useLeadDetailPage } from '@/hooks/use-lead-detail-page';

type LeadDetailPageState = ReturnType<typeof useLeadDetailPage>;

interface LeadDetailActivityProps extends Pick<
  LeadDetailPageState,
  | 'activities'
  | 'activitiesLoading'
  | 'note'
  | 'setNote'
  | 'isAddingNote'
  | 'setIsAddingNote'
  | 'addNoteMutation'
  | 'handleAddNote'
> {}

function getActivityEmoji(activityType: ActivityType) {
  switch (activityType) {
    case 'CREATED': return '🆕';
    case 'STATUS_CHANGED': return '🔄';
    case 'EMAIL_SENT': return '📧';
    case 'EMAIL_OPENED': return '👁️';
    case 'EMAIL_CLICKED': return '🔗';
    case 'EMAIL_REPLIED': return '💬';
    case 'NOTE_ADDED': return '📝';
    case 'TAG_ADDED': return '🏷️';
    case 'ENRICHED': return '✨';
    case 'CONTACTED': return '📞';
    default: return '📋';
  }
}

function getActivityLabel(activityType: ActivityType) {
  switch (activityType) {
    case 'CREATED': return 'Lead Created';
    case 'STATUS_CHANGED': return 'Status Changed';
    case 'EMAIL_SENT': return 'Email Sent';
    case 'EMAIL_OPENED': return 'Email Opened';
    case 'EMAIL_CLICKED': return 'Email Link Clicked';
    case 'EMAIL_REPLIED': return 'Email Replied';
    case 'NOTE_ADDED': return 'Note Added';
    case 'TAG_ADDED': return 'Tag Added';
    case 'ENRICHED': return 'Lead Enriched';
    case 'CONTACTED': return 'Contacted';
    default: return activityType;
  }
}

export function LeadDetailActivity({
  activities,
  activitiesLoading,
  note,
  setNote,
  isAddingNote,
  setIsAddingNote,
  addNoteMutation,
  handleAddNote,
}: LeadDetailActivityProps) {
  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
            Activity Timeline
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setIsAddingNote(!isAddingNote)}
            variant={isAddingNote ? 'secondary' : 'outline'}
          >
            <Plus className="h-3 w-3 mr-2" />
            {isAddingNote ? 'Cancel' : 'Add Note'}
          </Button>
        </div>
        <CardDescription>
          Track all interactions and changes with this lead
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isAddingNote && (
          <div className="mb-6 space-y-2 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border">
            <Textarea
              placeholder="Add a note about this lead..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="bg-white dark:bg-slate-950"
            />
            <Button onClick={handleAddNote} disabled={addNoteMutation.isPending} size="sm">
              {addNoteMutation.isPending ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        )}
        {activitiesLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : activities && activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="flex gap-3 pb-3 border-b last:border-b-0">
                <div className="mt-0.5">
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-base">
                    {getActivityEmoji(activity.activityType)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">
                      {getActivityLabel(activity.activityType)}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(activity.createdAt), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                  {activity.metadata && activity.activityType === 'STATUS_CHANGED' && (
                    <div className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded mt-2 inline-block">
                      {activity.metadata.oldStatus} → {activity.metadata.newStatus}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No activities yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
