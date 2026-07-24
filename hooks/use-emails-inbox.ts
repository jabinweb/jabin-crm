'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { FileText, Mail, Send, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type {
  ComposeReplyTo,
  Email,
  EmailFolder,
  Reply,
  SentimentAnalysis,
} from '@/types/emails-inbox';

export function useEmailsInbox() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { path } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const folderParam = searchParams.get('folder') as EmailFolder | null;

  const [selectedFolder, setSelectedFolder] = useState<EmailFolder>(folderParam || 'inbox');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emailReplies, setEmailReplies] = useState<Reply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);
  const [analyzingSentiment, setAnalyzingSentiment] = useState<string | null>(null);
  const [sentimentResults, setSentimentResults] = useState<Record<string, SentimentAnalysis>>({});
  const [replyTo, setReplyTo] = useState<ComposeReplyTo | undefined>(undefined);

  useEffect(() => {
    if (folderParam && folderParam !== selectedFolder) {
      setSelectedFolder(folderParam);
      setSelectedEmail(null);
    }
  }, [folderParam, selectedFolder]);

  useEffect(() => {
    const currentParam = searchParams.get('folder');
    if (!currentParam && selectedFolder) {
      router.push(path(`/dashboard/emails?folder=${selectedFolder}`));
    }
  }, []);

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

        const data = await response.json().catch(() => ({}));

        if (response.ok) {
          await queryClient.invalidateQueries({ queryKey: ['sent-emails'] });

          if (data.processed > 0) {
            toast.success(`${data.processed} new ${data.processed === 1 ? 'reply' : 'replies'}!`, {
              duration: 5000,
            });

            console.log(`[Auto-check] Found ${data.processed} new replies`);
          } else {
            console.log('[Auto-check] No new replies, but refreshed list');
          }
        } else if (response.status === 504 || data.timedOut) {
          console.log('[Auto-check] IMAP timed out — will retry later');
        } else {
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
      }

      if (isActive) {
        timeoutId = setTimeout(checkRepliesInBackground, 60 * 1000);
      }
    };

    checkRepliesInBackground();

    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [selectedFolder, autoCheckEnabled, queryClient]);

  const { data: sentEmails, isLoading: loadingSent } = useQuery({
    queryKey: ['sent-emails', selectedFolder],
    queryFn: async () => {
      const folder =
        selectedFolder === 'drafts' ? 'sent' : selectedFolder === 'inbox' || selectedFolder === 'starred' || selectedFolder === 'trash' || selectedFolder === 'sent'
          ? selectedFolder
          : 'sent';
      const response = await fetch(`/api/emails/log?limit=100&folder=${folder}`);
      if (!response.ok) throw new Error('Failed to fetch emails');
      const data = await response.json();
      return data.logs || [];
    },
    enabled: selectedFolder !== 'drafts',
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

  const inboxCount = (sentEmails || []).filter((e: Email) => e.repliedAt || (e.replyCount && e.replyCount > 0)).length;
  const starredCount = (sentEmails || []).filter((e: Email) => e.isStarred).length;
  const trashCount = selectedFolder === 'trash' ? sentEmails?.length || 0 : 0;

  const folders = [
    { id: 'inbox' as EmailFolder, name: 'Inbox', icon: Mail, count: selectedFolder === 'inbox' ? sentEmails?.length || 0 : inboxCount },
    { id: 'sent' as EmailFolder, name: 'Sent', icon: Send, count: selectedFolder === 'sent' ? sentEmails?.length || 0 : 0 },
    { id: 'drafts' as EmailFolder, name: 'Drafts', icon: FileText, count: draftsData?.length || 0 },
    { id: 'starred' as EmailFolder, name: 'Starred', icon: Star, count: selectedFolder === 'starred' ? sentEmails?.length || 0 : starredCount },
    { id: 'trash' as EmailFolder, name: 'Trash', icon: Trash2, count: trashCount },
  ];

  const getCurrentEmails = (): Email[] => {
    switch (selectedFolder) {
      case 'drafts':
        return (
          draftsData?.map((d: { recipientEmail: string; body?: string } & Email) => ({
            ...d,
            to: d.recipientEmail,
            snippet: d.body?.substring(0, 100),
          })) || []
        );
      case 'inbox':
      case 'sent':
      case 'starred':
      case 'trash':
        return sentEmails || [];
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

  const handleCompose = () => {
    setReplyTo(undefined);
    setComposeOpen(true);
  };

  const handleReply = () => {
    if (selectedEmail) {
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
        to: '',
        subject: `Fwd: ${selectedEmail.subject}`,
        body: `\n\n---------- Forwarded message ---------\nFrom: You\nTo: ${selectedEmail.to}\nSubject: ${selectedEmail.subject}\n\n${selectedEmail.body || ''}`,
      });
      setComposeOpen(true);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmail) return;

    const isDraft = selectedFolder === 'drafts';
    const inTrash = selectedFolder === 'trash';
    const confirmMsg = isDraft
      ? 'Are you sure you want to delete this draft?'
      : inTrash
        ? 'Permanently delete this email?'
        : 'Move this email to trash?';

    if (!confirm(confirmMsg)) {
      return;
    }

    const toastId = toast.loading(isDraft ? 'Deleting draft...' : inTrash ? 'Deleting...' : 'Moving to trash...');

    try {
      if (isDraft) {
        const response = await fetch(`/api/emails/drafts/${selectedEmail.id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed');
        await queryClient.invalidateQueries({ queryKey: ['email-drafts'] });
      } else {
        const response = await fetch('/api/emails/flags', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailId: selectedEmail.id,
            action: inTrash ? 'delete_forever' : 'trash',
          }),
        });
        if (!response.ok) throw new Error('Failed');
        await queryClient.invalidateQueries({ queryKey: ['sent-emails'] });
      }
      setSelectedEmail(null);
      toast.success(inTrash ? 'Deleted' : isDraft ? 'Draft deleted' : 'Moved to trash', { id: toastId });
    } catch {
      toast.error('Could not delete', { id: toastId });
    }
  };

  const handleToggleStar = async () => {
    if (!selectedEmail || selectedFolder === 'drafts') return;
    const starred = !!selectedEmail.isStarred;
    try {
      const response = await fetch('/api/emails/flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: selectedEmail.id,
          action: starred ? 'unstar' : 'star',
        }),
      });
      if (!response.ok) throw new Error('Failed');
      setSelectedEmail({ ...selectedEmail, isStarred: !starred });
      await queryClient.invalidateQueries({ queryKey: ['sent-emails'] });
    } catch {
      toast.error('Could not update star');
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

      setSelectedEmail(null);
      await queryClient.invalidateQueries({ queryKey: ['email-drafts'] });
      await queryClient.invalidateQueries({ queryKey: ['sent-emails'] });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send email';
      toast.error(message, { id: toastId });
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

      const data = await response.json().catch(() => ({}));

      if (response.status === 504 || data.timedOut) {
        await queryClient.invalidateQueries({ queryKey: ['sent-emails'] });
        toast.message('Reply check timed out — inbox refreshed from local log', { id: toastId });
        return;
      }

      if (!response.ok) {
        const errorMsg = data.hint
          ? `${data.message}\n\n${data.hint}`
          : data.message || 'Failed to check for replies';
        throw new Error(errorMsg);
      }

      await queryClient.invalidateQueries({ queryKey: ['sent-emails'] });

      if (data.processed > 0) {
        toast.success(
          data.message || `Found ${data.processed} new ${data.processed === 1 ? 'reply' : 'replies'}!`,
          { id: toastId }
        );
      } else if (data.errors && data.errors.length > 0) {
        toast.error(data.errors.join(' • '), { id: toastId, duration: 10000 });
      } else {
        toast.success(data.message || 'No new replies found', { id: toastId });
      }

      if (data.errors && data.errors.length > 0) {
        console.error('Reply check errors:', data.errors);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to check for replies';
      console.error('Error checking replies:', error);
      toast.error(message, { id: toastId, duration: 6000 });
    } finally {
      setRefreshing(false);
    }
  };

  const handleAnalyzeSentiment = async (
    replyId: string,
    replyBody: string,
    originalBody?: string
  ) => {
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
      setSentimentResults((prev) => ({
        ...prev,
        [replyId]: data.analysis,
      }));
      toast.success(`Sentiment: ${data.analysis.sentiment} (${data.analysis.confidence}% confidence)`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to analyze sentiment';
      console.error('Error analyzing sentiment:', error);
      toast.error(message);
    } finally {
      setAnalyzingSentiment(null);
    }
  };

  const markEmailAsRead = async (emailId: string, replies: Reply[] = []) => {
    try {
      const newReplyIds = replies.filter((reply) => reply.isNew).map((reply) => reply.id);

      if (newReplyIds.length > 0) {
        await fetch('/api/emails/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailId,
            replyIds: newReplyIds,
          }),
        });

        setEmailReplies((prevReplies) =>
          prevReplies.map((reply) => ({
            ...reply,
            isNew: false,
            viewedAt: new Date().toISOString(),
          }))
        );

        await queryClient.invalidateQueries({ queryKey: ['sent-emails'] });
      } else if (emailId) {
        await fetch('/api/emails/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailId }),
        });

        await queryClient.invalidateQueries({ queryKey: ['sent-emails'] });
      }
    } catch (error) {
      console.error('Error marking email as read:', error);
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

  const handleEmailClick = async (email: Email) => {
    setSelectedEmail(email);

    if (email.id && selectedFolder === 'sent') {
      const replies = await fetchEmailReplies(email.id);

      if (replies && replies.length > 0) {
        const hasNewReplies = replies.some((r) => r.isNew);
        if (hasNewReplies || (email.repliedAt && !email.openedAt)) {
          await markEmailAsRead(email.id, replies);
        }
      } else if (email.repliedAt && !email.openedAt) {
        await markEmailAsRead(email.id, []);
      }
    } else {
      setEmailReplies([]);
    }
  };

  const getCurrentFolderIcon = () => {
    const folder = folders.find((f) => f.id === selectedFolder);
    return folder ? folder.icon : Mail;
  };

  const getCurrentFolderName = () => {
    const folder = folders.find((f) => f.id === selectedFolder);
    return folder ? folder.name : 'Emails';
  };

  const repliesCount = getCurrentEmails().filter((email) => email.repliedAt && !email.openedAt).length;

  return {
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
    handleToggleStar,
    handleSendDraft,
    handleEditDraft,
    handleRefresh,
    handleAnalyzeSentiment,
    handleEmailClick,
    getCurrentFolderIcon,
    getCurrentFolderName,
  };
}

export type UseEmailsInboxReturn = ReturnType<typeof useEmailsInbox>;
