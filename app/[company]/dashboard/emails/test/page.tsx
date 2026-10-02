'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  Code,
  FileText,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

interface TestResult {
  success: boolean;
  messageId?: string;
  logId?: string;
  error?: string;
  deliveryTime?: number;
}

export default function EmailTesterPage() {
  const { path } = useWorkspacePaths();
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [viewMode, setViewMode] = useState<'visual' | 'html'>('visual');
  
  // Form state
  const [formData, setFormData] = useState({
    to: '',
    subject: 'Test email',
    body: 'This is a test email to check that sending works.\n\nBest regards',
    htmlBody: '',
    fromName: '',
    replyTo: '',
    testType: 'plain', // plain, html, or tracking
  });

  const handleSendTest = async () => {
    if (isLoading) return;
    if (!formData.to.trim()) {
      toast.error('Enter a recipient email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.to.trim())) {
      toast.error('Enter a valid recipient email address');
      return;
    }

    setIsLoading(true);
    setTestResult(null);
    const startTime = Date.now();

    try {
      const response = await fetch('/api/emails/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: formData.to,
          subject: formData.subject,
          body: formData.body,
          htmlBody: formData.htmlBody,
          fromName: formData.fromName,
          replyTo: formData.replyTo,
          testType: formData.testType,
        }),
      });

      const data = await response.json();
      const deliveryTime = Date.now() - startTime;

      if (response.ok) {
        setTestResult({
          success: true,
          messageId: data.messageId,
          logId: data.logId,
          deliveryTime,
        });
        toast.success('Test email sent successfully!');
      } else {
        setTestResult({
          success: false,
          error: data.error || 'Failed to send test email',
        });
        toast.error(data.error || 'Failed to send test email');
      }
    } catch (error) {
      setTestResult({
        success: false,
        error: 'Network error or server unavailable',
      });
      toast.error('Failed to send test email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadTemplate = (template: string) => {
    if (template === 'welcome') {
      setFormData({
        ...formData,
        subject: 'Welcome to Our Platform!',
        body: 'Hi there!\n\nWelcome to our platform. We\'re excited to have you on board.\n\nGet started by exploring our features.\n\nBest regards,\nThe Team',
        htmlBody: '<h1>Welcome!</h1><p>Hi there!</p><p>Welcome to our platform. We\'re excited to have you on board.</p><p>Get started by exploring our features.</p><p>Best regards,<br>The Team</p>',
      });
    } else if (template === 'followup') {
      setFormData({
        ...formData,
        subject: 'Following Up',
        body: 'Hi,\n\nI wanted to follow up on our previous conversation.\n\nDo you have any questions or would you like to discuss further?\n\nLooking forward to your response.\n\nBest regards',
        htmlBody: '<p>Hi,</p><p>I wanted to follow up on our previous conversation.</p><p>Do you have any questions or would you like to discuss further?</p><p>Looking forward to your response.</p><p>Best regards</p>',
      });
    } else if (template === 'tracking') {
      setFormData({
        ...formData,
        subject: 'Test Email with Tracking',
        body: 'This email includes tracking pixels to test open and click tracking.\n\nClick this link to test click tracking: https://example.com\n\nBest regards',
        htmlBody: '<p>This email includes tracking pixels to test open and click tracking.</p><p><a href="https://example.com">Click here to test click tracking</a></p><p>Best regards</p>',
        testType: 'tracking',
      });
    }
  };

  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Email Tester</h1>
          <p className="text-muted-foreground">
            Test your email configuration and deliverability
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Test Configuration */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Send Test Email</CardTitle>
              <CardDescription>
                Configure and send a test email to verify your setup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Recipient */}
              <div className="space-y-2">
                <Label htmlFor="to">
                  Recipient Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="to"
                  type="email"
                  placeholder="recipient@example.com"
                  value={formData.to}
                  onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                />
              </div>

              {/* From Name */}
              <div className="space-y-2">
                <Label htmlFor="fromName">From Name (Optional)</Label>
                <Input
                  id="fromName"
                  placeholder="Your Name"
                  value={formData.fromName}
                  onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                />
              </div>

              {/* Reply To */}
              <div className="space-y-2">
                <Label htmlFor="replyTo">Reply-To Email (Optional)</Label>
                <Input
                  id="replyTo"
                  type="email"
                  placeholder="reply@example.com"
                  value={formData.replyTo}
                  onChange={(e) => setFormData({ ...formData, replyTo: e.target.value })}
                />
              </div>

              {/* Test Type */}
              <div className="space-y-2">
                <Label htmlFor="testType">Test Type</Label>
                <Select value={formData.testType} onValueChange={(value) => setFormData({ ...formData, testType: value })}>
                  <SelectTrigger id="testType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plain">Plain Text</SelectItem>
                    <SelectItem value="html">HTML Email</SelectItem>
                    <SelectItem value="tracking">With Tracking</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Templates */}
              <div className="space-y-2">
                <Label>Quick Templates</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleLoadTemplate('welcome')}
                  >
                    Welcome
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleLoadTemplate('followup')}
                  >
                    Follow-up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleLoadTemplate('tracking')}
                  >
                    With Tracking
                  </Button>
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Email subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="testBody">Email Content</Label>
                  <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-auto">
                    <TabsList className="h-8">
                      <TabsTrigger value="visual" className="text-xs h-7">
                        <FileText className="h-3 w-3 mr-1" />
                        Text
                      </TabsTrigger>
                      <TabsTrigger value="html" className="text-xs h-7">
                        <Code className="h-3 w-3 mr-1" />
                        HTML
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                
                {viewMode === 'visual' ? (
                  <Textarea
                    id="testBody"
                    placeholder="Email body (plain text)"
                    rows={8}
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  />
                ) : (
                  <Textarea
                    id="testBody"
                    placeholder="Email body (HTML)"
                    rows={8}
                    value={formData.htmlBody}
                    onChange={(e) => setFormData({ ...formData, htmlBody: e.target.value })}
                    className="font-mono text-xs"
                  />
                )}
              </div>

              {/* Send Button */}
              <Button
                onClick={handleSendTest}
                disabled={isLoading || !formData.to}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Test Email...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Test Email
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Results & Info */}
        <div className="min-w-0 space-y-6">
          {/* Test Result */}
          {testResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {testResult.success ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      Test Successful
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-destructive" />
                      Test Failed
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {testResult.success ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">Delivery Time:</span>
                        <Badge variant="outline">{testResult.deliveryTime}ms</Badge>
                      </div>
                      {testResult.messageId && (
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">Message ID:</span>
                          <code className="min-w-0 break-all rounded bg-muted px-2 py-1 text-xs">
                            {testResult.messageId}
                          </code>
                        </div>
                      )}
                      {testResult.logId && (
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">Log ID:</span>
                          <code className="min-w-0 break-all rounded bg-muted px-2 py-1 text-xs">
                            {testResult.logId}
                          </code>
                        </div>
                      )}
                    </div>
                    <Alert>
                      <Mail className="h-4 w-4" />
                      <AlertDescription>
                        Test email sent successfully! Check your inbox at <strong>{formData.to}</strong>
                      </AlertDescription>
                    </Alert>
                  </>
                ) : (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      {testResult.error}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Where sending / reply settings live */}
          <Card>
            <CardHeader>
              <CardTitle>Sending &amp; Reply Settings</CardTitle>
              <CardDescription>
                Outgoing mail (SMTP) and reply tracking (IMAP) are set up under Integrations.
                If a test fails with a configuration error, check those settings first.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href={`${path('/dashboard/settings/integrations')}?panel=email`}>
                  <Settings className="mr-2 h-4 w-4" />
                  Open email settings
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                Once IMAP is connected, replies to your emails appear in the inbox automatically.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </div>
  );
}

