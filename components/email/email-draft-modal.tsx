'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Send, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface EmailDraft {
  leadId: string;
  companyName: string;
  recipientEmail?: string;
  contactName?: string;
  subject: string;
  body: string;
  tone: string;
}

interface EmailDraftModalProps {
  open: boolean;
  onClose: () => void;
  drafts: EmailDraft[];
}

export function EmailDraftModal({ open, onClose, drafts }: EmailDraftModalProps) {
  const [currentDraftIndex, setCurrentDraftIndex] = useState(0);
  const [editedDrafts, setEditedDrafts] = useState<EmailDraft[]>(drafts);
  const [isSending, setIsSending] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);

  // Update edited drafts when drafts prop changes
  useEffect(() => {
    if (drafts.length > 0) {
      setEditedDrafts(drafts);
      setCurrentDraftIndex(0);
      setAutoSaved(false);
    }
  }, [drafts]);

  // Auto-save drafts when modal opens
  useEffect(() => {
    if (open && drafts.length > 0 && !autoSaved) {
      console.log('Auto-saving drafts on modal open:', drafts.length);
      
      // Auto-save all drafts in the background
      const autoSave = async () => {
        try {
          const savePromises = drafts.map(draft =>
            fetch('/api/emails/drafts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                leadId: draft.leadId,
                companyName: draft.companyName,
                recipientEmail: draft.recipientEmail,
                contactName: draft.contactName,
                subject: draft.subject,
                emailBody: draft.body,
                tone: draft.tone,
              }),
            })
          );

          await Promise.all(savePromises);
          console.log(`Auto-saved ${drafts.length} drafts`);
          setAutoSaved(true);
        } catch (error) {
          console.error('Error auto-saving drafts:', error);
        }
      };

      autoSave();
    }
  }, [open, drafts, autoSaved]);

  const currentDraft = editedDrafts[currentDraftIndex];

  const handleSubjectChange = (value: string) => {
    const updated = [...editedDrafts];
    updated[currentDraftIndex].subject = value;
    setEditedDrafts(updated);
  };

  const handleBodyChange = (value: string) => {
    const updated = [...editedDrafts];
    updated[currentDraftIndex].body = value;
    setEditedDrafts(updated);
  };

  const handleSaveDraft = async () => {
    try {
      console.log('Saving draft:', currentDraft);
      
      const response = await fetch('/api/emails/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: currentDraft.leadId,
          companyName: currentDraft.companyName,
          recipientEmail: currentDraft.recipientEmail,
          contactName: currentDraft.contactName,
          subject: currentDraft.subject,
          emailBody: currentDraft.body,
          tone: currentDraft.tone,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Save draft error:', error);
        throw new Error(error.error || 'Failed to save draft');
      }

      const result = await response.json();
      console.log('Draft saved:', result);
      
      toast.success('Draft saved successfully');
      onClose();
    } catch (error: any) {
      console.error('Error saving draft:', error);
      toast.error(error.message || 'Failed to save draft');
    }
  };

  const handleSaveAllDrafts = async () => {
    try {
      console.log('Saving all drafts:', editedDrafts);
      
      const savePromises = editedDrafts.map(draft =>
        fetch('/api/emails/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: draft.leadId,
            companyName: draft.companyName,
            recipientEmail: draft.recipientEmail,
            contactName: draft.contactName,
            subject: draft.subject,
            emailBody: draft.body,
            tone: draft.tone,
          }),
        })
      );

      const results = await Promise.all(savePromises);
      
      if (results.some(r => !r.ok)) {
        const errors = await Promise.all(results.map(r => r.ok ? null : r.json()));
        console.error('Some drafts failed:', errors);
        throw new Error('Some drafts failed to save');
      }

      console.log('All drafts saved successfully');
      toast.success(`${editedDrafts.length} drafts saved successfully`);
      onClose();
    } catch (error: any) {
      console.error('Error saving drafts:', error);
      toast.error(error.message || 'Failed to save all drafts');
    }
  };

  const handleSendEmail = async () => {
    if (!currentDraft.recipientEmail) {
      toast.error('No email address found for this lead');
      return;
    }

    setIsSending(true);
    try {
      console.log('Sending email to:', currentDraft.recipientEmail);
      
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: currentDraft.recipientEmail,
          subject: currentDraft.subject,
          body: currentDraft.body,
          leadId: currentDraft.leadId,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to send email';
        try {
          const error = await response.json();
          console.error('Send email error:', error);
          errorMessage = error.error || error.message || error.details || errorMessage;
        } catch (jsonError) {
          // If response is not JSON, use status text
          console.error('Non-JSON error response:', response.statusText);
          errorMessage = `Server error: ${response.statusText || response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Email sent:', result);
      
      toast.success(`Email sent to ${currentDraft.companyName}`);
      
      // Move to next draft or close if last one
      if (currentDraftIndex < editedDrafts.length - 1) {
        setCurrentDraftIndex(currentDraftIndex + 1);
      } else {
        onClose();
      }
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(error.message || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendAll = async () => {
    setIsSending(true);
    try {
      console.log('Sending all emails:', editedDrafts.length);
      
      const sendPromises = editedDrafts
        .filter(draft => draft.recipientEmail) // Only send to drafts with email
        .map(async (draft) => {
          try {
            const response = await fetch('/api/emails/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: draft.recipientEmail,
                subject: draft.subject,
                body: draft.body,
                leadId: draft.leadId,
              }),
            });
            
            if (!response.ok) {
              let errorMessage = 'Failed to send';
              try {
                const error = await response.json();
                errorMessage = error.error || error.message || errorMessage;
              } catch {
                errorMessage = `Error ${response.status}`;
              }
              console.error(`Failed to send to ${draft.recipientEmail}:`, errorMessage);
              return { success: false, email: draft.recipientEmail, error: errorMessage };
            }
            
            return { success: true, email: draft.recipientEmail };
          } catch (error: any) {
            console.error(`Failed to send to ${draft.recipientEmail}:`, error);
            return { success: false, email: draft.recipientEmail, error: error.message };
          }
        });

      const results = await Promise.all(sendPromises);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      
      console.log(`Sent ${successCount} emails, ${failCount} failed`);
      
      if (failCount > 0) {
        const failedEmails = results.filter(r => !r.success);
        console.error('Failed emails:', failedEmails);
        toast.warning(`Sent ${successCount} emails, ${failCount} failed. Check console for details.`);
      } else {
        toast.success(`Sent ${successCount} emails successfully`);
      }
      
      onClose();
    } catch (error: any) {
      console.error('Error sending emails:', error);
      toast.error(error.message || 'Failed to send emails');
    } finally {
      setIsSending(false);
    }
  };

  if (!currentDraft) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Email Draft Preview</span>
          </DialogTitle>
          <DialogDescription>
            {editedDrafts.length > 1 
              ? `Reviewing email ${currentDraftIndex + 1} of ${editedDrafts.length}`
              : 'Review and edit your email before sending'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lead Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Recipient</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm font-semibold">{currentDraft.companyName}</span>
                {currentDraft.contactName && (
                  <span className="text-sm text-muted-foreground ml-2">
                    ({currentDraft.contactName})
                  </span>
                )}
              </div>
              {currentDraft.recipientEmail ? (
                <div className="break-all text-sm text-blue-600">{currentDraft.recipientEmail}</div>
              ) : (
                <div className="text-sm text-red-500">⚠️ No email address available</div>
              )}
            </CardContent>
          </Card>

          {/* Email Content */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={currentDraft.subject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                placeholder="Email subject"
              />
            </div>

            <div>
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                value={currentDraft.body}
                onChange={(e) => handleBodyChange(e.target.value)}
                placeholder="Email body"
                rows={12}
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Navigation for multiple drafts */}
          {editedDrafts.length > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDraftIndex(Math.max(0, currentDraftIndex - 1))}
                disabled={currentDraftIndex === 0}
              >
                ← Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentDraftIndex + 1} / {editedDrafts.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDraftIndex(Math.min(editedDrafts.length - 1, currentDraftIndex + 1))}
                disabled={currentDraftIndex === editedDrafts.length - 1}
              >
                Next →
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {editedDrafts.length > 1 ? (
                <>
                  <Button variant="outline" onClick={handleSaveAllDrafts}>
                    <Save className="h-4 w-4 mr-2" />
                    Save All ({editedDrafts.length})
                  </Button>
                  <Button onClick={handleSendAll} disabled={isSending}>
                    <Send className="h-4 w-4 mr-2" />
                    {isSending ? 'Sending...' : `Send All (${editedDrafts.length})`}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={handleSaveDraft}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </Button>
                  <Button 
                    onClick={handleSendEmail} 
                    disabled={isSending || !currentDraft.recipientEmail}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSending ? 'Sending...' : 'Send Email'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
