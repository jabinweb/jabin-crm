'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { AlertCircle, Mail, Search, Send, Trash2, Edit, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { EmailDraftModal } from '@/components/email/email-draft-modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CardListSkeleton, DetailSkeleton } from '@/components/loading';
import { confirmAction } from '@/lib/confirm-action';

export default function EmailDraftsPageWithSidebar() {
  const queryClient = useQueryClient();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [currentDrafts, setCurrentDrafts] = useState<any[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['email-drafts'],
    queryFn: async () => {
      const response = await fetch('/api/emails/drafts');
      if (!response.ok) {
        throw new Error('Failed to fetch drafts');
      }
      return response.json();
    },
  });

  const drafts = data?.drafts || [];
  
  // Filter drafts based on search
  const filteredDrafts = searchQuery
    ? drafts.filter((draft: any) =>
        draft.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        draft.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        draft.recipientEmail?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : drafts;

  const selectedDraft = selectedDraftId 
    ? drafts.find((d: any) => d.id === selectedDraftId)
    : filteredDrafts[0];

  const handleDeleteDraft = async (draftId: string) => {
    const ok = await confirmAction({
      title: 'Delete this draft?',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const response = await fetch(`/api/emails/drafts/${draftId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete draft');
      }

      toast.success('Draft deleted successfully');
      if (selectedDraftId === draftId) {
        setSelectedDraftId(null);
      }
      queryClient.invalidateQueries({ queryKey: ['email-drafts'] });
    } catch (error) {
      toast.error('Failed to delete draft');
    }
  };

  const handleViewDraft = (draft: any) => {
    setCurrentDrafts([{
      leadId: draft.leadId,
      companyName: draft.companyName,
      recipientEmail: draft.recipientEmail,
      contactName: draft.contactName,
      subject: draft.subject,
      body: draft.body,
      tone: draft.tone || 'professional',
    }]);
    setShowEmailModal(true);
  };

  const handleSendDraft = async (draft: any) => {
    if (!draft.recipientEmail) {
      toast.error('No email address found for this draft');
      return;
    }
    if (sendingId) return;

    setSendingId(draft.id);
    const toastId = toast.loading('Sending email...');

    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ draftId: draft.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      toast.success('Email sent successfully!', { id: toastId });
      queryClient.invalidateQueries({ queryKey: ['email-drafts'] });
      
      // Clear selection if sent draft is selected
      if (selectedDraftId === draft.id) {
        setSelectedDraftId(null);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send email', { id: toastId });
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-0 overflow-y-auto md:flex-row md:overflow-hidden">
      {/* Left Sidebar - Draft List */}
      <div className="w-full shrink-0 border-b bg-background md:w-80 md:border-b-0 md:border-r">
        <div className="flex max-h-[45vh] flex-col md:h-full md:max-h-none">
          <div className="border-b px-4 py-4 sm:px-6 lg:px-8">
            <h1 className="mb-3 text-lg font-semibold">Email Drafts</h1>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search drafts..."
                aria-label="Search drafts"
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4">
                <CardListSkeleton rows={6} />
              </div>
            ) : isError ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Couldn&apos;t load drafts.
              </div>
            ) : filteredDrafts.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery ? 'No matching drafts' : 'No drafts yet'}
              </div>
            ) : (
              filteredDrafts.map((draft: any) => (
                <button
                  key={draft.id}
                  onClick={() => setSelectedDraftId(draft.id)}
                  className={`w-full border-b px-4 py-3 text-left sm:px-6 md:py-4 lg:px-8 transition-colors hover:bg-accent ${
                    selectedDraft?.id === draft.id ? 'bg-accent' : ''
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between">
                    <span className="font-medium text-sm truncate flex-1">{draft.companyName}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {format(new Date(draft.createdAt), 'MMM d')}
                    </span>
                  </div>
                  <div className="mb-1 text-xs font-medium line-clamp-1">
                    {draft.subject}
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Mail className="mr-1 h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{draft.recipientEmail || 'No email'}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Draft Preview */}
      <div className="min-w-0 flex-1 md:overflow-y-auto">
        {isLoading ? (
          <div className="p-4 sm:p-6">
            <DetailSkeleton />
          </div>
        ) : isError ? (
          <div className="flex h-full items-center justify-center p-4 sm:p-6">
            <Card className="w-full max-w-md">
              <EmptyState
                icon={AlertCircle}
                title="Couldn't load drafts"
                description="Check your connection and try again."
                actionLabel="Try again"
                onAction={() => void refetch()}
              />
            </Card>
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 sm:p-6">
            <Card className="w-full max-w-md">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">No drafts yet</h3>
                <p className="mb-4 text-center text-muted-foreground">
                  Email drafts created from the "Contact Lead" feature will appear here
                </p>
                <Button asChild>
                  <DashboardLink href="/dashboard/leads">Go to Leads</DashboardLink>
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : selectedDraft ? (
          <Card className="flex min-h-full flex-col">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle className="mb-2 break-words text-xl sm:text-2xl">{selectedDraft.subject}</CardTitle>
                  <div className="mt-2 space-y-1">
                    <CardDescription className="flex items-center gap-2 flex-wrap">
                      <span>To: {selectedDraft.recipientEmail || 'No recipient'}</span>
                      <span>•</span>
                      <span>{selectedDraft.companyName}</span>
                    </CardDescription>
                    <CardDescription className="text-xs">
                      Created {format(new Date(selectedDraft.createdAt), 'MMM d, yyyy at HH:mm')}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDraft(selectedDraft)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleSendDraft(selectedDraft)}
                    disabled={!selectedDraft.recipientEmail || sendingId === selectedDraft.id}
                  >
                    {sendingId === selectedDraft.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    aria-label="Delete draft"
                    disabled={sendingId === selectedDraft.id}
                    onClick={() => handleDeleteDraft(selectedDraft.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="rounded-none border bg-muted/30 p-4 sm:p-6">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap break-words">
                  {selectedDraft.body}
                </div>
              </div>
              
              {selectedDraft.tone && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium">Tone:</span>
                  <span className="capitalize">{selectedDraft.tone}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Email Draft Modal */}
      <EmailDraftModal
        open={showEmailModal}
        onClose={() => {
          setShowEmailModal(false);
          queryClient.invalidateQueries({ queryKey: ['email-drafts'] });
        }}
        drafts={currentDrafts}
      />
    </div>
  );
}

