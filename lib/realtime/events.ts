/** Realtime event type constants for the CRM hub. */
export const REALTIME_EVENTS = {
  TICKET_UPDATED: 'ticket.updated',
  TICKET_COMMENT: 'ticket.comment',
  TICKET_PRESENCE: 'ticket.presence',
  TICKET_TYPING: 'ticket.typing',
  TICKET_MOVED: 'ticket.moved',
  NOTIFICATION_CREATED: 'notification.created',
  CHAT_MESSAGE: 'chat.message',
  /** Team messaging: something changed in a conversation (ids only — clients refetch). */
  CONVERSATION_UPDATED: 'conversation.updated',
  /** Team messaging: someone is typing in a conversation. */
  CONVERSATION_TYPING: 'conversation.typing',
  CHAT_SESSION: 'chat.session',
  BOARD_MOVED: 'board.moved',
  /** A project doc was saved, created, moved or deleted. */
  PROJECT_DOC_UPDATED: 'project.doc.updated',
  /** A team meeting changed (invite, RSVP, reschedule, someone joined/left the room) — ids only. */
  MEETING_UPDATED: 'meeting.updated',
  /** Optional nudge when a lead goes stale. */
  LEAD_STALE: 'lead.stale',
} as const;

export type RealtimeEventType = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];
