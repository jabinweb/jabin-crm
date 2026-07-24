'use client';

import {
  AlertCircle,
  Clock,
  Forward,
  Loader2,
  Mail,
  MailOpen,
  Minus,
  Pencil,
  Reply as ReplyIcon,
  Send,
  Sparkles,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { extractReplyContent } from '@/lib/email/extract-reply-content';
import { SectionSkeleton } from '@/components/loading';
import type { Email, EmailFolder, Reply, SentimentAnalysis } from '@/types/emails-inbox';

interface EmailDetailPanelProps {
  selectedEmail: Email | null;
  selectedFolder: EmailFolder;
  emailReplies: Reply[];
  loadingReplies: boolean;
  analyzingSentiment: string | null;
  sentimentResults: Record<string, SentimentAnalysis>;
  onReply: () => void;
  onForward: () => void;
  onDelete: () => void;
  onToggleStar?: () => void;
  onSendDraft: () => void;
  onEditDraft: () => void;
  onAnalyzeSentiment: (replyId: string, replyBody: string, originalBody?: string) => void;
}

export function EmailDetailPanel({
  selectedEmail,
  selectedFolder,
  emailReplies,
  loadingReplies,
  analyzingSentiment,
  sentimentResults,
  onReply,
  onForward,
  onDelete,
  onToggleStar,
  onSendDraft,
  onEditDraft,
  onAnalyzeSentiment,
}: EmailDetailPanelProps) {
  if (!selectedEmail) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Mail className="mx-auto h-16 w-16 text-muted-foreground" />
          <p className="mt-4 text-lg font-medium">No email selected</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Select an email from the list to view its contents
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-semibold">
              {selectedEmail.subject || '(No subject)'}
            </h2>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">From:</span>
                <span className="text-muted-foreground">You</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">To:</span>
                <span className="text-muted-foreground">{selectedEmail.to}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Date:</span>
                <span className="text-muted-foreground">
                  {selectedEmail.sentAt
                    ? format(new Date(selectedEmail.sentAt), 'MMMM d, yyyy h:mm a')
                    : 'Not sent'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedFolder === 'drafts' ? (
              <>
                <Button variant="outline" size="sm" onClick={onEditDraft}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="default" size="sm" onClick={onSendDraft}>
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </>
            ) : (
              <>
                {onToggleStar && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onToggleStar}
                    aria-label={selectedEmail.isStarred ? 'Unstar' : 'Star'}
                  >
                    <Star
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedEmail.isStarred && 'fill-amber-400 text-amber-500'
                      )}
                    />
                    {selectedEmail.isStarred ? 'Starred' : 'Star'}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={onReply}>
                  <ReplyIcon className="mr-2 h-4 w-4" />
                  Reply
                </Button>
                <Button variant="outline" size="sm" onClick={onForward}>
                  <Forward className="mr-2 h-4 w-4" />
                  Forward
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {selectedFolder === 'trash' ? 'Delete forever' : 'Trash'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 pb-3 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-none bg-blue-100 flex items-center justify-center">
                <span className="text-sm font-semibold text-blue-700">
                  {selectedFolder === 'sent'
                    ? 'You'
                    : selectedEmail.from?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <div className="font-medium text-sm">
                  {selectedFolder === 'sent' ? 'You' : selectedEmail.from || 'Unknown'}
                </div>
                <div className="text-xs text-muted-foreground">to {selectedEmail.to}</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {selectedEmail.sentAt
                ? format(new Date(selectedEmail.sentAt), 'MMM d, yyyy h:mm a')
                : 'Not sent'}
            </div>
          </div>

          <div className="prose max-w-none">
            <div
              className="whitespace-pre-wrap text-sm leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: selectedEmail.body || '',
              }}
            />
          </div>
        </div>

        {(emailReplies.length > 0 || (selectedEmail.repliedAt && selectedEmail.replyBody)) && (
          <div className="mt-6 space-y-4">
            {emailReplies.map((reply, index) => (
              <div
                key={reply.id}
                className={cn(
                  'border rounded-none p-4',
                  reply.isNew ? 'bg-blue-50 border-blue-200' : 'bg-muted/30'
                )}
              >
                <div className="flex items-center justify-between mb-3 pb-3 border-b">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-none bg-emerald-100 flex items-center justify-center">
                      <span className="text-sm font-semibold text-emerald-700">
                        {reply.from.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {reply.from}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Reply {index + 1}
                        </Badge>
                        {reply.isNew && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-blue-500 hover:bg-blue-600">
                            NEW
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">to You</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(reply.sentAt), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>

                {reply.subject && reply.subject !== selectedEmail.subject && (
                  <div className="mb-3 text-sm font-medium text-muted-foreground">
                    {reply.subject}
                  </div>
                )}

                <div className="prose max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {extractReplyContent(reply.body)}
                  </div>
                </div>

                {sentimentResults[reply.id] ? (
                  <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-none">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium">AI Analysis</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            sentimentResults[reply.id].sentiment === 'POSITIVE'
                              ? 'default'
                              : sentimentResults[reply.id].sentiment === 'NEGATIVE'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className="flex items-center gap-1"
                        >
                          {sentimentResults[reply.id].sentiment === 'POSITIVE' && (
                            <TrendingUp className="h-3 w-3" />
                          )}
                          {sentimentResults[reply.id].sentiment === 'NEGATIVE' && (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {sentimentResults[reply.id].sentiment === 'NEUTRAL' && (
                            <Minus className="h-3 w-3" />
                          )}
                          {sentimentResults[reply.id].sentiment}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {sentimentResults[reply.id].confidence}% confident
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                      <div>
                        <span className="text-muted-foreground">Intent:</span>
                        <span className="ml-1 font-medium">
                          {sentimentResults[reply.id].intent.replace('_', ' ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Urgency:</span>
                        <Badge
                          variant={
                            sentimentResults[reply.id].urgency === 'HIGH'
                              ? 'destructive'
                              : sentimentResults[reply.id].urgency === 'MEDIUM'
                                ? 'secondary'
                                : 'outline'
                          }
                          className="ml-1 text-[10px]"
                        >
                          {sentimentResults[reply.id].urgency}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <strong>Suggested Response:</strong>{' '}
                      {sentimentResults[reply.id].suggestedResponse}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onAnalyzeSentiment(reply.id, reply.body, selectedEmail.body)
                      }
                      disabled={analyzingSentiment === reply.id}
                    >
                      {analyzingSentiment === reply.id ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-3 w-3" />
                          Analyze Sentiment
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {reply.body && extractReplyContent(reply.body).length < reply.body.length && (
                  <details className="mt-3">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        Show quoted text
                      </span>
                    </summary>
                    <div className="mt-2 pl-4 border-l-2 border-muted text-xs text-muted-foreground whitespace-pre-wrap">
                      {reply.body.substring(extractReplyContent(reply.body).length)}
                    </div>
                  </details>
                )}
              </div>
            ))}

            {emailReplies.length === 0 && selectedEmail.repliedAt && selectedEmail.replyBody && (
              <div className="border rounded-none p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-3 pb-3 border-b">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-none bg-emerald-100 flex items-center justify-center">
                      <span className="text-sm font-semibold text-emerald-700">
                        {selectedEmail.to.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {selectedEmail.to}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Reply
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">to You</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(selectedEmail.repliedAt), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>

                {selectedEmail.replySubject && (
                  <div className="mb-3 text-sm font-medium text-muted-foreground">
                    {selectedEmail.replySubject}
                  </div>
                )}

                <div className="prose max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {extractReplyContent(selectedEmail.replyBody)}
                  </div>
                </div>

                {selectedEmail.replyBody &&
                  extractReplyContent(selectedEmail.replyBody).length <
                    selectedEmail.replyBody.length && (
                    <details className="mt-3">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          Show quoted text
                        </span>
                      </summary>
                      <div className="mt-2 pl-4 border-l-2 border-muted text-xs text-muted-foreground whitespace-pre-wrap">
                        {selectedEmail.replyBody.substring(
                          extractReplyContent(selectedEmail.replyBody).length
                        )}
                      </div>
                    </details>
                  )}
              </div>
            )}

            {loadingReplies && (
              <SectionSkeleton lines={4} className="border rounded-none p-6" />
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
