export type EmailFolder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'trash';

export interface Email {
  id: string;
  from?: string;
  to: string;
  subject: string;
  body?: string;
  snippet?: string;
  status: string;
  sentAt?: Date;
  repliedAt?: Date;
  replySubject?: string;
  replyBody?: string;
  openedAt?: Date;
  lead?: {
    companyName: string;
    contactName?: string;
  };
  isRead?: boolean;
  isStarred?: boolean;
  replyCount?: number;
  newReplyCount?: number;
  latestReply?: {
    from: string;
    body: string;
    sentAt: Date;
    isNew: boolean;
  };
}

export interface Reply {
  id: string;
  from: string;
  subject: string;
  body: string;
  sentAt: Date;
  messageId?: string;
  inReplyTo?: string;
  viewedAt?: string | null;
  isNew?: boolean;
}

export interface SentimentAnalysis {
  sentiment: string;
  confidence: number;
  intent: string;
  urgency: string;
  suggestedResponse: string;
}

export interface ComposeReplyTo {
  to: string;
  subject: string;
  body?: string;
}
