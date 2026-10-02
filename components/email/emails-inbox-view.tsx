'use client';

import {
  AlertCircle,
  Clock,
  Mail,
  MailOpen,
  Pencil,
  RefreshCw,
  Search,
  Send,
  FileText,
  Star,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmailComposeDialog } from '@/components/email/email-compose-dialog';
import { EmailDetailPanel } from '@/components/email/email-detail-panel';
import { CardListSkeleton } from '@/components/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { humanizeEnum } from '@/lib/crm/humanize-enum';
import type { Email } from '@/types/emails-inbox';
import type { UseEmailsInboxReturn } from '@/hooks/use-emails-inbox';

function getStatusIcon(status: string) {
  const label = <span className="sr-only">{humanizeEnum(status)}</span>;
  switch (status) {
    case 'SENT':
    case 'DELIVERED':
      return (
        <>
          <MailOpen aria-hidden className="h-4 w-4 text-green-600 dark:text-green-400" />
          {label}
        </>
      );
    case 'OPENED':
      return (
        <>
          <Mail aria-hidden className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          {label}
        </>
      );
    case 'PENDING':
      return (
        <>
          <Clock aria-hidden className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          {label}
        </>
      );
    case 'FAILED':
      return (
        <>
          <AlertCircle aria-hidden className="h-4 w-4 text-destructive" />
          {label}
        </>
      );
    default:
      return null;
  }
}

/** Static map so the header icon isn't a component "created" during render. */
const FOLDER_ICONS: Record<string, LucideIcon> = {
  inbox: Mail,
  sent: Send,
  drafts: FileText,
  starred: Star,
  trash: Trash2,
};

const EMPTY_FOLDER_COPY: Record<string, { title: string; description: string }> = {
  inbox: {
    title: 'No replies yet',
    description: 'When someone replies to an email you sent, it shows up here.',
  },
  sent: {
    title: 'Nothing sent yet',
    description: 'Emails you send appear here. Use Compose to write one.',
  },
  drafts: {
    title: 'No drafts',
    description: 'Drafts you save while writing an email are kept here.',
  },
  starred: {
    title: 'No starred emails',
    description: 'Star an email to keep it handy here.',
  },
  trash: {
    title: 'Trash is empty',
    description: 'Deleted emails stay here until you remove them for good.',
  },
};

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
  listError,
  retryList,
  repliesCount,
  handleCompose,
  handleReply,
  handleForward,
  handleDelete,
  handleToggleStar,
  handleSendDraft,
  handleEditDraft,
  handleRefresh,
  handleAnalyzeSentiment,
  handleEmailClick,
  clearSelectedEmail,
  getCurrentFolderName,
}: EmailsInboxViewProps) {
  const FolderIcon = FOLDER_ICONS[selectedFolder] ?? Mail;
  const currentFolder = folders.find((f) => f.id === selectedFolder);

  return (
    <div className="flex h-full min-h-0">
      <div
        className={cn(
          'w-full border-r flex flex-col bg-background md:w-[380px] lg:w-[420px] shrink-0',
          selectedEmail ? 'hidden md:flex' : 'flex'
        )}
      >
        <div className="border-b">
          <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <FolderIcon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">{getCurrentFolderName()}</h2>
              {currentFolder && currentFolder.count > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {currentFolder.count}
                </Badge>
              )}
              {repliesCount > 0 && (
                <Badge className="bg-emerald-600 text-xs text-white hover:bg-emerald-600">
                  {repliesCount} New {repliesCount === 1 ? 'Reply' : 'Replies'}
                </Badge>
              )}
            </div>
            <Button size="sm" onClick={handleCompose} className="h-8">
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Compose
            </Button>
          </div>

          <div className="flex items-center gap-2 px-4 pb-3 sm:px-6 lg:px-8">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search..."
                aria-label={`Search ${getCurrentFolderName().toLowerCase()}`}
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
                  aria-pressed={autoCheckEnabled}
                  title="Automatically check for new replies"
                  onClick={() => setAutoCheckEnabled(!autoCheckEnabled)}
                >
                  <Badge
                    variant={autoCheckEnabled ? 'default' : 'secondary'}
                    className="text-xs cursor-pointer"
                  >
                    {autoCheckEnabled ? 'Auto-check on' : 'Auto-check off'}
                  </Badge>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label={selectedFolder === 'sent' ? 'Check for replies now' : 'Refresh'}
                title={
                  selectedFolder === 'sent'
                    ? 'Check for replies now (also checks automatically)'
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
            <div className="p-4">
              <CardListSkeleton rows={8} />
            </div>
          ) : listError ? (
            <EmptyState
              icon={AlertCircle}
              title="Couldn't load emails"
              description="Check your connection and try again."
              actionLabel="Try again"
              onAction={retryList}
            />
          ) : filteredEmails.length === 0 ? (
            searchQuery.trim() ? (
              <EmptyState
                icon={Search}
                title="No matching emails"
                description="Try a different search term."
                actionLabel="Clear search"
                onAction={() => setSearchQuery('')}
              />
            ) : (
              <EmptyState
                icon={FolderIcon}
                title={EMPTY_FOLDER_COPY[selectedFolder]?.title ?? 'No emails here'}
                description={EMPTY_FOLDER_COPY[selectedFolder]?.description}
                actionLabel={selectedFolder === 'trash' ? undefined : 'Compose'}
                onAction={selectedFolder === 'trash' ? undefined : handleCompose}
              />
            )
          ) : (
            <div>
              {filteredEmails.map((email: Email) => (
                <button
                  type="button"
                  key={email.id}
                  aria-current={selectedEmail?.id === email.id ? 'true' : undefined}
                  className={cn(
                    'block w-full text-left cursor-pointer border-b transition-colors pl-3 pr-4 sm:pl-5 sm:pr-6 lg:pl-7 lg:pr-8 py-2.5 border-l-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    selectedEmail?.id === email.id
                      ? 'bg-primary/10 border-l-primary'
                      : email.repliedAt && !email.openedAt
                        ? 'bg-emerald-500/10 hover:bg-emerald-500/15 border-l-emerald-500'
                        : cn(
                            'hover:bg-muted/50 border-l-transparent',
                            !email.isRead && 'bg-muted/20'
                          )
                  )}
                  onClick={() => handleEmailClick(email)}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-0.5 pr-2 min-w-0 max-w-none md:max-w-[340px]">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-shrink-0">{getStatusIcon(email.status)}</div>
                        <p
                          className={cn(
                            'text-xs break-words line-clamp-1',
                            !email.isRead && 'font-semibold',
                            email.repliedAt && !email.openedAt && 'font-semibold text-emerald-700 dark:text-emerald-400'
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
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
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
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div
        className={cn(
          'min-w-0 flex-1',
          selectedEmail ? 'flex' : 'hidden md:flex'
        )}
      >
        <EmailDetailPanel
          selectedEmail={selectedEmail}
          selectedFolder={selectedFolder}
          emailReplies={emailReplies}
          loadingReplies={loadingReplies}
          analyzingSentiment={analyzingSentiment}
          sentimentResults={sentimentResults}
          onBack={clearSelectedEmail}
          onReply={handleReply}
          onForward={handleForward}
          onDelete={handleDelete}
          onToggleStar={handleToggleStar}
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
