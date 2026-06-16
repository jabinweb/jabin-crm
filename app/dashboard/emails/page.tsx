'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { EmailComposeDialog } from '@/components/email/email-compose-dialog';
import {
  Send,
  FileText,
  Star,
  Trash2,
  Search,
  RefreshCw,
  Pencil,
  Mail,
  MailOpen,
  Clock,
  AlertCircle,
  Reply,
  Forward,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type EmailFolder = 'sent' | 'drafts' | 'starred' | 'trash';

interface Email {
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

interface Reply {
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

export default function EmailsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const folderParam = searchParams.get('folder') as EmailFolder | null;
  
  const [selectedFolder, setSelectedFolder] = useState<EmailFolder>(folderParam || 'sent');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emailReplies, setEmailReplies] = useState<Reply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);
  const [analyzingSentiment, setAnalyzingSentiment] = useState<string | null>(null);
  const [sentimentResults, setSentimentResults] = useState<Record<string, any>>({});
  const [replyTo, setReplyTo] = useState<{
    to: string;
    subject: string;
    body?: string;
  } | undefined>(undefined);

  // Update selected folder when URL changes
  useEffect(() => {
    if (folderParam && folderParam !== selectedFolder) {
      setSelectedFolder(folderParam);
      setSelectedEmail(null);
    }
  }, [folderParam, selectedFolder]);

  // Update URL when folder changes from sidebar
  useEffect(() => {
    const currentParam = searchParams.get('folder');
    if (!currentParam && selectedFolder) {
      router.push(`/dashboard/emails?folder=${selectedFolder}`);
    }
  }, []);

  // Auto-check for new replies every 2 minutes when on sent folder
  useEffect(() => {
    if (selectedFolder !== 'sent' || !autoCheckEnabled) return;

    let isActive = true;
    let timeoutId: NodeJS.Timeout;

    const checkRepliesInBackground = async () => {
      if (!isActive) return;

      try {
        console.log('[Auto-check] Checking for new replies...');
        
        const response = await fetch('/api/emails/check-replies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ daysBack: 7 }),
        });

        const data = await response.json();

        if (response.ok) {
          // Always refresh the email list to show updated reply counts
          await queryClient.invalidateQueries({ queryKey: ['sent-emails'] });
          
          if (data.processed > 0) {
            // Show subtle notification for new replies
            toast.success(`${data.processed} new ${data.processed === 1 ? 'reply' : 'replies'}!`, {
              duration: 5000,
            });
            
            console.log(`[Auto-check] Found ${data.processed} new replies`);
          } else {
            console.log('[Auto-check] No new replies, but refreshed list');
          }
        } else {
          // Log error but don't show toast for background checks
          console.error('[Auto-check] Error response:', data);
          if (data.error === 'IMAP not configured') {
            console.warn('[Auto-check] IMAP not configured - stopping auto-check');
            setAutoCheckEnabled(false);
            toast.error('Please configure IMAP in Email Settings to receive replies', {
              duration: 10000,
            });
          }
        }
      } catch (error) {
        console.error('[Auto-check] Error checking replies:', error);
        // Don't show error toast for background checks
      }

      // Schedule next check in 20 seconds
      if (isActive) {
        timeoutId = setTimeout(checkRepliesInBackground, 20 * 1000);
      }
    };

    // Start first check immediately, then every 20 seconds
    checkRepliesInBackground();

    // Cleanup on unmount or folder change
    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [selectedFolder, autoCheckEnabled, queryClient]);

  const { data: sentEmails, isLoading: loadingSent } = useQuery({
    queryKey: ['sent-emails'],
    queryFn: async () => {
      const response = await fetch('/api/emails/log?limit=100');
      if (!response.ok) throw new Error('Failed to fetch sent emails');
      const data = await response.json();
      console.log('[Email List] Fetched emails:', data.logs?.length, 'emails');
      // Log reply counts for debugging
      const withReplies = data.logs?.filter((e: any) => e.replyCount > 0) || [];
      if (withReplies.length > 0) {
        console.log('[Email List] Emails with replies:', withReplies.map((e: any) => ({
          subject: e.subject,
          replyCount: e.replyCount,
          newReplyCount: e.newReplyCount,
          hasLatestReply: !!e.latestReply
        })));
      }
      return data.logs || [];
    },
  });

  const { data: draftsData, isLoading: loadingDrafts } = useQuery({
    queryKey: ['email-drafts'],
    queryFn: async () => {
      const response = await fetch('/api/emails/drafts');
      if (!response.ok) throw new Error('Failed to fetch drafts');
      const data = await response.json();
      return data.drafts || [];
    },
  });

  const folders = [
    { id: 'sent' as EmailFolder, name: 'Sent', icon: Send, count: sentEmails?.length || 0 },
    { id: 'drafts' as EmailFolder, name: 'Drafts', icon: FileText, count: draftsData?.length || 0 },
    { id: 'starred' as EmailFolder, name: 'Starred', icon: Star, count: 0 },
    { id: 'trash' as EmailFolder, name: 'Trash', icon: Trash2, count: 0 },
  ];

  const getCurrentEmails = (): Email[] => {
    switch (selectedFolder) {
      case 'sent':
        return sentEmails || [];
      case 'drafts':
        return draftsData?.map((d: any) => ({
          ...d,
          to: d.recipientEmail,
          snippet: d.body?.substring(0, 100),
        })) || [];
      case 'starred':
      case 'trash':
      default:
        return [];
    }
  };

  const emails = getCurrentEmails();
  const filteredEmails = searchQuery
    ? emails.filter(
        (email) =>
          email.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          email.to?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          email.from?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : emails;

  const getStatusIcon = (status: string) => {
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
  };

  const handleCompose = () => {
    setReplyTo(undefined);
    setComposeOpen(true);
  };

  const handleReply = () => {
    if (selectedEmail) {
      // In Sent folder, reply to the person we sent the email to
      const replyToEmail = selectedEmail.to;
      
      setReplyTo({
        to: replyToEmail,
        subject: selectedEmail.subject,
        body: selectedEmail.body,
      });
      setComposeOpen(true);
    }
  };

  const handleForward = () => {
    if (selectedEmail) {
      setReplyTo({
        to: '', // Empty, user will fill in
        subject: `Fwd: ${selectedEmail.subject}`,
        body: `\n\n---------- Forwarded message ---------\nFrom: You\nTo: ${selectedEmail.to}\nSubject: ${selectedEmail.subject}\n\n${selectedEmail.body || ''}`,
      });
      setComposeOpen(true);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmail) return;

    const isDraft = selectedFolder === 'drafts';
    const confirmMsg = isDraft 
      ? 'Are you sure you want to delete this draft?'
      : 'Are you sure you want to delete this email?';

    if (!confirm(confirmMsg)) {
      return;
    }

    const toastId = toast.loading(isDraft ? 'Deleting draft...' : 'Deleting email...');
    
    try {
      const endpoint = isDraft 
        ? `/api/emails/drafts/${selectedEmail.id}`
        : '/api/emails/delete';
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: isDraft ? undefined : JSON.stringify({ emailId: selectedEmail.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to delete ${isDraft ? 'draft' : 'email'}`);
      }

      toast.success(`${isDraft ? 'Draft' : 'Email'} deleted successfully`, { id: toastId });
      
      // Clear selection and refresh list
      setSelectedEmail(null);
      await queryClient.invalidateQueries({ 
        queryKey: isDraft ? ['email-drafts'] : ['sent-emails'] 
      });
    } catch (error: any) {
      console.error(`Error deleting ${isDraft ? 'draft' : 'email'}:`, error);
      toast.error(error.message || `Failed to delete ${isDraft ? 'draft' : 'email'}`, { id: toastId });
    }
  };

  const handleSendDraft = async () => {
    if (!selectedEmail) return;

    const toastId = toast.loading('Sending email...');

    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: selectedEmail.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      toast.success('Email sent successfully!', { id: toastId });
      
      // Clear selection and refresh both lists
      setSelectedEmail(null);
      await queryClient.invalidateQueries({ queryKey: ['email-drafts'] });
      await queryClient.invalidateQueries({ queryKey: ['sent-emails'] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to send email', { id: toastId });
    }
  };

  const handleEditDraft = () => {
    if (!selectedEmail) return;
    
    setReplyTo({
      to: selectedEmail.to,
      subject: selectedEmail.subject,
      body: selectedEmail.body,
    });
    setComposeOpen(true);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const toastId = toast.loading('Checking for new replies...');
    
    try {
      const response = await fetch('/api/emails/check-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysBack: 7 }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Show helpful error message
        const errorMsg = data.hint 
          ? `${data.message}\n\n${data.hint}`
          : data.message || 'Failed to check for replies';
        throw new Error(errorMsg);
      }
      
      // Invalidate queries to refresh the email list
      await queryClient.invalidateQueries({ queryKey: ['sent-emails'] });
      
      // Show success or error message based on results
      if (data.processed > 0) {
        toast.success(data.message || `Found ${data.processed} new ${data.processed === 1 ? 'reply' : 'replies'}!`, { id: toastId });
      } else if (data.errors && data.errors.length > 0) {
        // Show detailed error message
        toast.error(data.errors.join(' • '), { id: toastId, duration: 10000 });
      } else {
        toast.success(data.message || 'No new replies found', { id: toastId });
      }
      
      // Log errors if any
      if (data.errors && data.errors.length > 0) {
        console.error('Reply check errors:', data.errors);
      }
    } catch (error: any) {
      console.error('Error checking replies:', error);
      toast.error(error.message || 'Failed to check for replies', { id: toastId, duration: 6000 });
    } finally {
      setRefreshing(false);
    }
  };

  const handleAnalyzeSentiment = async (replyId: string, replyBody: string, originalBody?: string) => {
    setAnalyzingSentiment(replyId);
    try {
      const response = await fetch('/api/ai/analyze-sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replyContent: replyBody,
          originalEmail: originalBody,
        }),
      });

      if (!response.ok) throw new Error('Failed to analyze sentiment');

      const data = await response.json();
      setSentimentResults(prev => ({
        ...prev,
        [replyId]: data.analysis,
      }));
      toast.success(`Sentiment: ${data.analysis.sentiment} (${data.analysis.confidence}% confidence)`);
    } catch (error: any) {
      console.error('Error analyzing sentiment:', error);
      toast.error(error.message || 'Failed to analyze sentiment');
    } finally {
      setAnalyzingSentiment(null);
    }
  };

  const markEmailAsRead = async (emailId: string, replies: Reply[] = []) => {
    try {
      // Get IDs of new (unviewed) replies from the provided replies array
      const newReplyIds = replies
        .filter(reply => reply.isNew)
        .map(reply => reply.id);

      if (newReplyIds.length > 0) {
        await fetch('/api/emails/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            emailId,
            replyIds: newReplyIds,
          }),
        });
        
        // Update local state to remove NEW badges immediately
        setEmailReplies(prevReplies => 
          prevReplies.map(reply => ({
            ...reply,
            isNew: false,
            viewedAt: new Date().toISOString(),
          }))
        );
        
        // Invalidate queries to refresh the email list sidebar
        await queryClient.invalidateQueries({ queryKey: ['sent-emails'] });
      } else if (emailId) {
        // Even if no new replies, mark email as opened
        await fetch('/api/emails/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailId }),
        });
        
        // Invalidate queries to refresh the email list
        await queryClient.invalidateQueries({ queryKey: ['sent-emails'] });
      }
    } catch (error) {
      console.error('Error marking email as read:', error);
    }
  };

  const handleEmailClick = async (email: Email) => {
    setSelectedEmail(email);
    
    // Fetch replies for this email
    if (email.id && selectedFolder === 'sent') {
      const replies = await fetchEmailReplies(email.id);
      
      // Mark as read if it has new replies or hasn't been opened yet
      if (replies && replies.length > 0) {
        const hasNewReplies = replies.some(r => r.isNew);
        if (hasNewReplies || (email.repliedAt && !email.openedAt)) {
          await markEmailAsRead(email.id, replies);
        }
      } else if (email.repliedAt && !email.openedAt) {
        // Email has reply but no LeadActivity entries yet
        await markEmailAsRead(email.id, []);
      }
    } else {
      setEmailReplies([]);
    }
  };

  const fetchEmailReplies = async (emailId: string): Promise<Reply[]> => {
    setLoadingReplies(true);
    try {
      const response = await fetch(`/api/emails/${emailId}/replies`);
      if (response.ok) {
        const data = await response.json();
        const replies = data.replies || [];
        setEmailReplies(replies);
        return replies;
      } else {
        console.error('Failed to fetch replies');
        setEmailReplies([]);
        return [];
      }
    } catch (error) {
      console.error('Error fetching replies:', error);
      setEmailReplies([]);
      return [];
    } finally {
      setLoadingReplies(false);
    }
  };

  const getCurrentFolderIcon = () => {
    const folder = folders.find(f => f.id === selectedFolder);
    return folder ? folder.icon : Mail;
  };

  const getCurrentFolderName = () => {
    const folder = folders.find(f => f.id === selectedFolder);
    return folder ? folder.name : 'Emails';
  };

  // Extract only the new reply content, removing quoted/forwarded text
  const extractReplyContent = (replyBody: string): string => {
    if (!replyBody) return '';
    
    // Split by newlines to work line by line
    const lines = replyBody.split('\n');
    const replyLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Check if this line starts a quoted section
      if (
        // Gmail/Outlook quote patterns
        trimmedLine.match(/^On .+? wrote:?\s*$/i) ||
        trimmedLine.match(/^On .+?<.+?>\s*wrote:?\s*$/i) ||
        trimmedLine.match(/^\d{4}-\d{2}-\d{2}.+? wrote:?\s*$/i) ||
        // Quote markers
        trimmedLine.startsWith('>') ||
        // Forward/Original message markers
        trimmedLine.match(/^-{3,}\s*(Original|Forwarded)\s*Message\s*-{3,}/i) ||
        trimmedLine.match(/^-{3,}\s*Original Message\s*-{3,}/i) ||
        // Email headers
        (trimmedLine.match(/^(From|Sent|To|Subject|Date):\s*.+/i) && i > 0) ||
        // Check if previous line was empty and this looks like a quote start
        (i > 0 && lines[i-1].trim() === '' && trimmedLine.match(/^On .+/i))
      ) {
        // Stop here - everything after is quoted
        break;
      }
      
      replyLines.push(line);
    }
    
    // Join the reply lines back together and trim
    let cleanedBody = replyLines.join('\n').trim();
    
    // Remove trailing empty lines
    cleanedBody = cleanedBody.replace(/\n\s*\n\s*$/g, '');
    
    // If the result is too short or empty, return a reasonable portion
    if (cleanedBody.length < 2) {
      // Try to get first paragraph
      const firstPara = replyBody.split('\n\n')[0];
      return firstPara.substring(0, 500).trim();
    }
    
    return cleanedBody;
  };

  const FolderIcon = getCurrentFolderIcon();
  
  // Calculate count of emails with new unread replies
  const repliesCount = getCurrentEmails().filter(email => email.repliedAt && !email.openedAt).length;

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Email List */}
      <div className="w-[420px] border-r flex flex-col bg-background">
        {/* Header with Compose Button */}
        <div className="border-b">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <FolderIcon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">{getCurrentFolderName()}</h2>
              {folders.find(f => f.id === selectedFolder)?.count > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {folders.find(f => f.id === selectedFolder)?.count}
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
                    variant={autoCheckEnabled ? "default" : "secondary"} 
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
                title={selectedFolder === 'sent' ? 'Check for replies now (auto-checks every 20 sec)' : 'Refresh'}
              >
                <RefreshCw className={cn(
                  "h-3.5 w-3.5",
                  refreshing && "animate-spin"
                )} />
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loadingSent || loadingDrafts ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading...
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="p-8 text-center">
              <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No emails in {selectedFolder}
              </p>
            </div>
          ) : (
            <div>
              {filteredEmails.map((email) => (
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
                        <div className="flex-shrink-0">
                          {getStatusIcon(email.status)}
                        </div>
                        <p className={cn(
                          "text-xs break-words line-clamp-1",
                          !email.isRead && "font-semibold",
                          email.repliedAt && !email.openedAt && "font-semibold text-emerald-700"
                        )}>
                          {email.to}
                        </p>
                      </div>
                      <p className={cn(
                        "text-sm leading-snug break-words line-clamp-2",
                        !email.isRead ? "font-semibold" : "font-medium",
                        email.repliedAt && !email.openedAt && "font-semibold"
                      )}>
                        {email.subject || '(No subject)'}
                      </p>
                      <p className="text-xs text-muted-foreground leading-snug break-words line-clamp-2">
                        {email.latestReply ? (
                          <>
                            <span className="font-medium text-emerald-600">{email.latestReply.from}: </span>
                            {email.latestReply.body.substring(0, 100)}
                          </>
                        ) : (
                          email.snippet || email.body?.substring(0, 150) || ''
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {email.sentAt
                          ? format(new Date(email.sentAt), 'MMM d')
                          : 'Draft'}
                      </span>
                      {email.newReplyCount && email.newReplyCount > 0 ? (
                        <Badge variant="default" className="text-[10px] h-4 px-1 bg-blue-500 hover:bg-blue-600">
                          <Mail className="mr-0.5 h-2.5 w-2.5" />
                          {email.newReplyCount} New {email.newReplyCount === 1 ? 'Reply' : 'Replies'}
                        </Badge>
                      ) : email.replyCount && email.replyCount > 0 ? (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {email.replyCount} {email.replyCount === 1 ? 'Reply' : 'Replies'}
                        </Badge>
                      ) : email.repliedAt && !email.openedAt ? (
                        <Badge variant="default" className="text-[10px] h-4 px-1 bg-emerald-500 hover:bg-emerald-600">
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

      {/* Email Detail */}
      <div className="flex-1">
        {selectedEmail ? (
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
                      <span className="text-muted-foreground">
                        {selectedEmail.to}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Date:</span>
                      <span className="text-muted-foreground">
                        {selectedEmail.sentAt
                          ? format(
                              new Date(selectedEmail.sentAt),
                              'MMMM d, yyyy h:mm a'
                            )
                          : 'Not sent'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selectedFolder === 'drafts' ? (
                    // Draft actions: Edit, Send, Delete
                    <>
                      <Button variant="outline" size="sm" onClick={handleEditDraft}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button variant="default" size="sm" onClick={handleSendDraft}>
                        <Send className="mr-2 h-4 w-4" />
                        Send
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </>
                  ) : (
                    // Sent email actions: Reply, Forward, Delete
                    <>
                      <Button variant="outline" size="sm" onClick={handleReply}>
                        <Reply className="mr-2 h-4 w-4" />
                        Reply
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleForward}>
                        <Forward className="mr-2 h-4 w-4" />
                        Forward
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-6">
              {/* Original Email */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3 pb-3 border-b">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-none bg-blue-100 flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-700">
                        {selectedFolder === 'sent' ? 'You' : (selectedEmail.from?.charAt(0).toUpperCase() || 'U')}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {selectedFolder === 'sent' ? 'You' : (selectedEmail.from || 'Unknown')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        to {selectedEmail.to}
                      </div>
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

              {/* Reply Thread - Gmail Style */}
              {(emailReplies.length > 0 || (selectedEmail.repliedAt && selectedEmail.replyBody)) && (
                <div className="mt-6 space-y-4">
                  {/* Show replies from LeadActivity (newer threaded format) */}
                  {emailReplies.map((reply, index) => (
                    <div key={reply.id} className={cn(
                      "border rounded-none p-4",
                      reply.isNew ? "bg-blue-50 border-blue-200" : "bg-muted/30"
                    )}>
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
                            <div className="text-xs text-muted-foreground">
                              to You
                            </div>
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
                      
                      {/* AI Sentiment Analysis */}
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
                                  sentimentResults[reply.id].sentiment === 'POSITIVE' ? 'default' :
                                  sentimentResults[reply.id].sentiment === 'NEGATIVE' ? 'destructive' :
                                  'secondary'
                                }
                                className="flex items-center gap-1"
                              >
                                {sentimentResults[reply.id].sentiment === 'POSITIVE' && <TrendingUp className="h-3 w-3" />}
                                {sentimentResults[reply.id].sentiment === 'NEGATIVE' && <TrendingDown className="h-3 w-3" />}
                                {sentimentResults[reply.id].sentiment === 'NEUTRAL' && <Minus className="h-3 w-3" />}
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
                              <span className="ml-1 font-medium">{sentimentResults[reply.id].intent.replace('_', ' ')}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Urgency:</span>
                              <Badge 
                                variant={
                                  sentimentResults[reply.id].urgency === 'HIGH' ? 'destructive' :
                                  sentimentResults[reply.id].urgency === 'MEDIUM' ? 'secondary' :
                                  'outline'
                                }
                                className="ml-1 text-[10px]"
                              >
                                {sentimentResults[reply.id].urgency}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <strong>Suggested Response:</strong> {sentimentResults[reply.id].suggestedResponse}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAnalyzeSentiment(reply.id, reply.body, selectedEmail.body)}
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
                      
                      {/* Show quoted text option */}
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
                  
                  {/* Fallback: Show single reply from EmailLog (older format) */}
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
                            <div className="text-xs text-muted-foreground">
                              to You
                            </div>
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
                      
                      {/* Show quoted text option */}
                      {selectedEmail.replyBody && extractReplyContent(selectedEmail.replyBody).length < selectedEmail.replyBody.length && (
                        <details className="mt-3">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              Show quoted text
                            </span>
                          </summary>
                          <div className="mt-2 pl-4 border-l-2 border-muted text-xs text-muted-foreground whitespace-pre-wrap">
                            {selectedEmail.replyBody.substring(extractReplyContent(selectedEmail.replyBody).length)}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                  
                  {/* Loading state */}
                  {loadingReplies && (
                    <div className="border rounded-none p-6 bg-muted/30 flex items-center justify-center">
                      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                      <span className="text-sm text-muted-foreground">Loading replies...</span>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Mail className="mx-auto h-16 w-16 text-muted-foreground" />
              <p className="mt-4 text-lg font-medium">No email selected</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Select an email from the list to view its contents
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Compose Dialog */}
      <EmailComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        replyTo={replyTo}
      />
    </div>
  );
}

