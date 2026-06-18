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
  Eye,
  Code,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TestResult {
  success: boolean;
  messageId?: string;
  logId?: string;
  error?: string;
  deliveryTime?: number;
}

export default function EmailTesterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [viewMode, setViewMode] = useState<'visual' | 'html'>('visual');
  
  // Form state
  const [formData, setFormData] = useState({
    to: '',
    subject: 'Test Email from Lead Gen',
    body: 'This is a test email to verify email sending functionality.\n\nBest regards,\nYour Lead Gen System',
    htmlBody: '',
    fromName: '',
    replyTo: '',
    testType: 'plain', // plain, html, or tracking
  });

  const handleSendTest = async () => {
    if (!formData.to) {
      toast.error('Please enter a recipient email address');
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
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Email Tester</h2>
          <p className="text-muted-foreground">
            Test your email configuration and deliverability
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Test Configuration */}
        <div className="space-y-6">
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
                  Recipient Email <span className="text-red-500">*</span>
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
                  <SelectTrigger>
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
                <div className="flex gap-2">
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
                <div className="flex items-center justify-between">
                  <Label>Email Content</Label>
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
                    placeholder="Email body (plain text)"
                    rows={8}
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  />
                ) : (
                  <Textarea
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
        <div className="space-y-6">
          {/* Test Result */}
          {testResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {testResult.success ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Test Successful
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-500" />
                      Test Failed
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {testResult.success ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Delivery Time:</span>
                        <Badge variant="outline">{testResult.deliveryTime}ms</Badge>
                      </div>
                      {testResult.messageId && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Message ID:</span>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {testResult.messageId.substring(0, 20)}...
                          </code>
                        </div>
                      )}
                      {testResult.logId && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Log ID:</span>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {testResult.logId.substring(0, 20)}...
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

          {/* Configuration Info */}
          <Card>
            <CardHeader>
              <CardTitle>Email Configuration</CardTitle>
              <CardDescription>
                Current email service configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Provider:</span>
                  <Badge variant="outline">Nodemailer</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">SMTP Configured:</span>
                  <Badge variant="outline" className="bg-green-500/10 text-green-500">
                    Active
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* IMAP Reply Checker */}
          <Card>
            <CardHeader>
              <CardTitle>Reply Tracking</CardTitle>
              <CardDescription>
                Since you&apos;re using Nodemailer (SMTP), replies are received directly to your email inbox. 
                Use the IMAP reply checker to automatically scan for and log replies.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>IMAP Configuration</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Add these to your .env file to enable reply checking:
                </p>
                <div className="bg-muted p-3 rounded-none mt-2 font-mono text-xs space-y-1">
                  <div>IMAP_HOST=imap.gmail.com</div>
                  <div>IMAP_PORT=993</div>
                  <div>IMAP_USER=your-email@gmail.com</div>
                  <div>IMAP_PASSWORD=your-app-password</div>
                </div>
              </div>

              <div>
                <Label>Manual Reply Check</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/emails/check-replies`}
                    className="font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${typeof window !== 'undefined' ? window.location.origin : ''}/api/emails/check-replies`
                      );
                      toast.success('API URL copied!');
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  POST to this endpoint or set up a cron job to periodically check for new replies
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

