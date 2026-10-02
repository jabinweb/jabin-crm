export type NotificationType = 
  | 'LEAVE_REQUEST'
  | 'LEAVE_APPROVED'
  | 'LEAVE_REJECTED'
  | 'ATTENDANCE'
  | 'PAYROLL'
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED'
  | 'DOCUMENT_UPLOADED'
  | 'PERFORMANCE_REVIEW'
  | 'GENERAL'
  | 'NEW_MESSAGE'
  | 'PROJECT_TASK_ASSIGNED'
  | 'PROJECT_TASK_COMMENTED'
  | 'PROJECT_TASK_UPDATED'
  | 'PROJECT_MENTION'
  | 'MEETING_INVITE'
  | 'MEETING_UPDATED'
  | 'MEETING_CANCELLED'
  | 'MEETING_RSVP'
  | 'MEETING_REMINDER'
  | 'MEETING_STARTED';

export interface Notification {
  id: string
  title: string
  message: string
  type: NotificationType
  targetRole: string[]
  targetUserId?: string | null
  read: boolean
  metadata?: Record<string, any> | null
  createdAt: Date
  expiresAt: Date
  companyId?: number | null
}
