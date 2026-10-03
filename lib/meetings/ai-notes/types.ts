/** AI meeting notes shapes shared by API responses and the client (no server imports). */
import type { MeetingPerson } from '../types';
import type { ActionItem } from './rules';

export type ActionItemDTO = ActionItem & {
  /** The matched attendee (avatar), when the owner was resolved to a person */
  owner: MeetingPerson | null;
};

export type TranscriptLineDTO = {
  id: string;
  speakerId: string;
  speakerName: string;
  startedAt: string;
  text: string;
};

export type MeetingNotesDTO = {
  meetingId: string;
  /** Live capture is on: every participant's client uploads its own mic */
  enabled: boolean;
  startedBy: { id: string; name: string | null } | null;
  startedAt: string | null;
  summary: string | null;
  keyPoints: string[];
  actionItems: ActionItemDTO[];
  generatedAt: string | null;
  /** A summary is being written right now */
  generating: boolean;
  /** Last summary attempt failed (shown with a Regenerate button) */
  error: string | null;
  /** Ordered by when each clip started; null when the caller asked for status only */
  transcript: TranscriptLineDTO[] | null;
  segmentCount: number;
  lastSegmentAt: string | null;
  /** Organizer / admin: toggle capture, regenerate */
  canControl: boolean;
  /** Tick items, create follow-ups / tasks */
  canEdit: boolean;
  /** A Gemini key is available for this meeting (null when not checked) */
  aiConfigured: boolean | null;
  meetingOver: boolean;
};

export type MeetingNotesResponse = { notes: MeetingNotesDTO };
