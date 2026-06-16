'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Send, Loader2, X, Sparkles, Lightbulb } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { TemplateSelector } from './template-selector';

interface EmailComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replyTo?: {
    to: string;
    subject: string;
    body?: string;
  };
  leadData?: {
    contactName?: string;
    companyName?: string;
    email?: string;
    phone?: string;
    website?: string;
    industry?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

export function EmailComposeDialog({
  open,
  onOpenChange,
  replyTo,
  leadData,
}: EmailComposeDialogProps) {
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [generatingSubject, setGeneratingSubject] = useState(false);
  const [optimizingContent, setOptimizingContent] = useState(false);
  const [subjectVariants, setSubjectVariants] = useState<any[]>([]);
  const [contentOptimization, setContentOptimization] = useState<any>(null);
  const [formData, setFormData] = useState({
    to: '',
    subject: '',
    body: '',
  });

  // Update form data when replyTo changes or dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        to: replyTo?.to || leadData?.email || '',
        subject: replyTo?.subject
          ? replyTo.subject.startsWith('Re:')
            ? replyTo.subject
            : `Re: ${replyTo.subject}`
          : '',
        body: replyTo?.body 
          ? `\n\n--- Original Message ---\n${replyTo.body}` 
          : '',
      });
    } else {
      // Reset form when dialog closes
      setFormData({
        to: '',
        subject: '',
        body: '',
      });
    }
  }, [open, replyTo, leadData]);

  const handleSend = async () => {
    if (!formData.to || !formData.subject) {
      toast.error('Please fill in recipient and subject');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: formData.to,
          subject: formData.subject,
          body: formData.body,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to send email';
        try {
          const error = await response.json();
          errorMessage =
            error.error || error.message || error.details || errorMessage;
        } catch {
          errorMessage = `Server error: ${response.statusText || response.status}`;
        }
        throw new Error(errorMessage);
      }

      toast.success('Email sent successfully');
      queryClient.invalidateQueries({ queryKey: ['sent-emails'] });
      onOpenChange(false);
      setFormData({ to: '', subject: '', body: '' });
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(error.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleGenerateSubjects = async () => {
    if (!formData.body) {
      toast.error('Please write your email content first');
      return;
    }

    setGeneratingSubject(true);
    try {
      const response = await fetch('/api/ai/generate-subject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: 'Your Company', // TODO: Get from user profile
          productService: formData.body.substring(0, 200),
          tone: 'professional',
          count: 5,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate subject lines');

      const data = await response.json();
      setSubjectVariants(data.variants);
      toast.success('Generated 5 subject line variants');
    } catch (error: any) {
      console.error('Error generating subjects:', error);
      toast.error(error.message || 'Failed to generate subject lines');
    } finally {
      setGeneratingSubject(false);
    }
  };

  const handleOptimizeContent = async () => {
    if (!formData.body) {
      toast.error('Please write your email content first');
      return;
    }

    setOptimizingContent(true);
    try {
      const response = await fetch('/api/ai/optimize-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: formData.body,
          companyName: 'Your Company', // TODO: Get from user profile
          goal: 'Generate leads',
        }),
      });

      if (!response.ok) throw new Error('Failed to optimize content');

      const data = await response.json();
      setContentOptimization(data.optimization);
      toast.success(`Content Score: ${data.optimization.score}/100`);
    } catch (error: any) {
      console.error('Error optimizing content:', error);
      toast.error(error.message || 'Failed to optimize content');
    } finally {
      setOptimizingContent(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {replyTo ? 'Reply' : 'Compose Email'}
          </DialogTitle>
          <DialogDescription>
            {replyTo
              ? 'Reply to this email'
              : 'Send a new email'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Selector - Only show for new emails with lead data */}
          {!replyTo && leadData && (
            <div className="flex justify-end">
              <TemplateSelector
                leadData={leadData}
                onSelect={(template) => {
                  setFormData({
                    ...formData,
                    subject: template.subject,
                    body: template.body,
                  });
                }}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              value={formData.to}
              onChange={(e) =>
                setFormData({ ...formData, to: e.target.value })
              }
              placeholder="recipient@example.com"
              disabled={!!replyTo}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="subject">Subject</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={generatingSubject || !formData.body}
                    onClick={handleGenerateSubjects}
                  >
                    {generatingSubject ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-3 w-3" />
                        AI Suggest
                      </>
                    )}
                  </Button>
                </PopoverTrigger>
                {subjectVariants.length > 0 && (
                  <PopoverContent className="w-96" align="end">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">AI-Generated Subject Lines</h4>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {subjectVariants.map((variant, idx) => (
                          <div
                            key={idx}
                            className="p-2 border rounded-none hover:bg-accent cursor-pointer transition-colors"
                            onClick={() => {
                              setFormData({ ...formData, subject: variant.subject });
                              setSubjectVariants([]);
                              toast.success('Subject line applied');
                            }}
                          >
                            <p className="font-medium text-sm">{variant.subject}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {variant.strategy}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {variant.expectedOpenRate} Open Rate
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                )}
              </Popover>
            </div>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              placeholder="Email subject"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="body">Message</Label>
              <div className="flex gap-2">
                {contentOptimization && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Lightbulb className="mr-2 h-3 w-3" />
                        Score: {contentOptimization.score}/100
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-96" align="end">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium text-sm mb-2">Content Analysis</h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Clarity:</span>
                              <span className="ml-2 font-medium">{contentOptimization.improvements.clarity}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Persuasiveness:</span>
                              <span className="ml-2 font-medium">{contentOptimization.improvements.persuasiveness}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Professional:</span>
                              <span className="ml-2 font-medium">{contentOptimization.improvements.professionalism}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Call to Action:</span>
                              <span className="ml-2 font-medium">{contentOptimization.improvements.callToAction}%</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-sm mb-1">Suggestions</h4>
                          <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
                            {contentOptimization.suggestions.map((suggestion: string, idx: number) => (
                              <li key={idx}>{suggestion}</li>
                            ))}
                          </ul>
                        </div>

                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setFormData({ ...formData, body: contentOptimization.optimizedContent });
                            toast.success('Applied optimized content');
                          }}
                        >
                          Apply Optimized Version
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={optimizingContent || !formData.body}
                  onClick={handleOptimizeContent}
                >
                  {optimizingContent ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-3 w-3" />
                      AI Optimize
                    </>
                  )}
                </Button>
              </div>
            </div>
            <Textarea
              id="body"
              value={formData.body}
              onChange={(e) =>
                setFormData({ ...formData, body: e.target.value })
              }
              placeholder="Write your message here..."
              className="min-h-[200px]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

