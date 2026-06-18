'use client';

import {
  AlertCircle,
  Clock,
  Mail,
  MailOpen,
  Pencil,
  RefreshCw,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmailComposeDialog } from '@/components/email/email-compose-dialog';
import { EmailDetailPanel } from '@/components/email/email-detail-panel';
import { cn } from '@/lib/utils';
import type { Email } from '@/types/emails-inbox';
import type { UseEmailsInboxReturn } from '@/hooks/use-emails-inbox';

function getStatusIcon(status: string) {
  switch (status) {
    case 'SENT':
    case 'DELIVERED':
      return <MailOpen className="h-4 w-4 text-green-500" />;
    case 'OPENED':
      return <Mail className="h-4 w-4 text-blue-500" />;
    case 'PENDING':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'FAILED':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
}

type EmailsInboxViewProps = UseEmailsInboxReturn;

export function EmailsInboxView({
  selectedFolder,
  selectedEmail,
  emailReplies,
  loadingReplies,
  searchQuery,
  setSearchQuery,
  composeOpen,
  setComposeOpen,
  refreshing,
  autoCheckEnabled,
  setAutoCheckEnabled,
  analyzingSentiment,
  sentimentResults,
  replyTo,
  folders,
  filteredEmails,
  loadingSent,
  loadingDrafts,
  repliesCount,
  handleCompose,
  handleReply,
  handleForward,
  handleDelete,
  handleSendDraft,
  handleEditDraft,
  handleRefresh,
  handleAnalyzeSentiment,
  handleEmailClick,
  getCurrentFolderIcon,
  getCurrentFolderName,
}: EmailsInboxViewProps) {
  const FolderIcon = getCurrentFolderIcon();
  const currentFolder = folders.find((f) => f.id === selectedFolder);

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="w-[420px] border-r flex flex-col bg-background">
        <div className="border-b">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <FolderIcon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">{getCurrentFolderName()}</h2>
              {currentFolder && currentFolder.count > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {currentFolder.count}
                </Badge>
              )}
              {repliesCount > 0 && (
                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-xs">
                  {repliesCount} New {repliesCount === 1 ? 'Reply' : 'Replies'}
                </Badge>
              )}
            </div>
            <Button size="sm" onClick={handleCompose} className="h-8">
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Compose
            </Button>
          </div>

          <div className="flex items-center gap-2 px-3 pb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              {selectedFolder === 'sent' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setAutoCheckEnabled(!autoCheckEnabled)}
                >
                  <Badge
                    variant={autoCheckEnabled ? 'default' : 'secondary'}
                    className="text-xs cursor-pointer"
                  >
                    {autoCheckEnabled ? '🔄 Auto ON' : '⏸️ Auto OFF'}
                  </Badge>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                disabled={refreshing}
                title={
                  selectedFolder === 'sent'
                    ? 'Check for replies now (auto-checks every 20 sec)'
                    : 'Refresh'
                }
              >
                <RefreshCw
                  className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')}
                />
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loadingSent || loadingDrafts ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredEmails.length === 0 ? (
            <div className="p-8 text-center">
              <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No emails in {selectedFolder}
              </p>
            </div>
          ) : (
            <div>
              {filteredEmails.map((email: Email) => (
                <div
                  key={email.id}
                  className={cn(
                    'cursor-pointer border-b transition-all hover:shadow-none',
                    selectedEmail?.id === email.id
                      ? 'bg-blue-50 border-l-4 border-l-blue-500 pl-3 pr-3 py-2.5'
                      : email.repliedAt && !email.openedAt
                        ? 'hover:bg-emerald-50/50 border-l-4 border-l-emerald-400 pl-3 pr-3 py-2.5 bg-emerald-50/30'
                        : 'hover:bg-muted/50 border-l-4 border-l-transparent pl-3 pr-3 py-2.5',
                    !email.isRead && 'bg-muted/20'
                  )}
                  onClick={() => handleEmailClick(email)}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-0.5 pr-2 max-w-[340px]">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-shrink-0">{getStatusIcon(email.status)}</div>
                        <p
                          className={cn(
                            'text-xs break-words line-clamp-1',
                            !email.isRead && 'font-semibold',
                            email.repliedAt && !email.openedAt && 'font-semibold text-emerald-700'
                          )}
                        >
                          {email.to}
                        </p>
                      </div>
                      <p
                        className={cn(
                          'text-sm leading-snug break-words line-clamp-2',
                          !email.isRead ? 'font-semibold' : 'font-medium',
                          email.repliedAt && !email.openedAt && 'font-semibold'
                        )}
                      >
                        {email.subject || '(No subject)'}
                      </p>
                      <p className="text-xs text-muted-foreground leading-snug break-words line-clamp-2">
                        {email.latestReply ? (
                          <>
                            <span className="font-medium text-emerald-600">
                              {email.latestReply.from}:{' '}
                            </span>
                            {email.latestReply.body.substring(0, 100)}
                          </>
                        ) : (
                          email.snippet || email.body?.substring(0, 150) || ''
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {email.sentAt ? format(new Date(email.sentAt), 'MMM d') : 'Draft'}
                      </span>
                      {email.newReplyCount && email.newReplyCount > 0 ? (
                        <Badge
                          variant="default"
                          className="text-[10px] h-4 px-1 bg-blue-500 hover:bg-blue-600"
                        >
                          <Mail className="mr-0.5 h-2.5 w-2.5" />
                          {email.newReplyCount} New{' '}
                          {email.newReplyCount === 1 ? 'Reply' : 'Replies'}
                        </Badge>
                      ) : email.replyCount && email.replyCount > 0 ? (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {email.replyCount} {email.replyCount === 1 ? 'Reply' : 'Replies'}
                        </Badge>
                      ) : email.repliedAt && !email.openedAt ? (
                        <Badge
                          variant="default"
                          className="text-[10px] h-4 px-1 bg-emerald-500 hover:bg-emerald-600"
                        >
                          <Mail className="mr-0.5 h-2.5 w-2.5" />
                          New Reply
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1">
        <EmailDetailPanel
          selectedEmail={selectedEmail}
          selectedFolder={selectedFolder}
          emailReplies={emailReplies}
          loadingReplies={loadingReplies}
          analyzingSentiment={analyzingSentiment}
          sentimentResults={sentimentResults}
          onReply={handleReply}
          onForward={handleForward}
          onDelete={handleDelete}
          onSendDraft={handleSendDraft}
          onEditDraft={handleEditDraft}
          onAnalyzeSentiment={handleAnalyzeSentiment}
        />
      </div>

      <EmailComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        replyTo={replyTo}
      />
    </div>
  );
}
