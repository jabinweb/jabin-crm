/** Workspace presence windows (see /api/presence and hooks/use-presence). */

/** Clients heartbeat every 30s while a dashboard tab is visible; 2 missed beats = offline. */
export const ONLINE_WINDOW_MS = 2 * 60_000;

/** A ticket viewer counts while their ticket page heartbeat is under a minute old. */
export const TICKET_VIEW_WINDOW_MS = 60_000;

export type PresencePerson = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

export type PresenceSnapshot = {
  me: string;
  /** Staff seen in the last ONLINE_WINDOW_MS (includes me). */
  online: Array<PresencePerson & { lastSeenAt: string }>;
  /** ticketId → teammates with that ticket open (typing when replying). */
  tickets: Record<string, Array<PresencePerson & { typing?: boolean }>>;
  /** docId → teammates with that doc open. */
  docs: Record<string, PresencePerson[]>;
};
