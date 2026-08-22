/** Realtime event type constants for the CRM hub. */
export const REALTIME_EVENTS = {
  TICKET_UPDATED: 'ticket.updated',
  TICKET_COMMENT: 'ticket.comment',
  TICKET_PRESENCE: 'ticket.presence',
  TICKET_TYPING: 'ticket.typing',
  TICKET_MOVED: 'ticket.moved',
  NOTIFICATION_CREATED: 'notification.created',
  CHAT_MESSAGE: 'chat.message',
  CHAT_SESSION: 'chat.session',
  BOARD_MOVED: 'board.moved',
  /** Optional nudge when a lead goes stale. */
  LEAD_STALE: 'lead.stale',
} as const;

export type RealtimeEventType = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];
