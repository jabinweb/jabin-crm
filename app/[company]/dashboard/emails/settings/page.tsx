'use client';

import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Mail, Save, Loader2, Send, Inbox, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { FormSkeleton, PageHeaderSkeleton } from '@/components/loading';

export default function EmailSettingsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [showImapPassword, setShowImapPassword] = useState(false);
  const [hasSmtpPassword, setHasSmtpPassword] = useState(false);
  const [hasImapPassword, setHasImapPassword] = useState(false);
  const [formData, setFormData] = useState({
    companyEmail: '',
    // SMTP Configuration (for sending)
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    smtpFrom: '',
    // IMAP Configuration (for receiving)
    imapHost: '',
    imapPort: 993,
    imapSecure: true,
    imapUser: '',
    imapPassword: '',
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await fetch('/api/profile');
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        companyEmail: profile.companyEmail || '',
        smtpHost: profile.smtpHost || '',
        smtpPort: profile.smtpPort || 587,
        smtpSecure: profile.smtpSecure || false,
        smtpUser: profile.smtpUser || '',
        smtpPassword: '', // Never populate password from server
        smtpFrom: profile.smtpFrom || '',
        imapHost: profile.imapHost || '',
        imapPort: profile.imapPort || 993,
        imapSecure: profile.imapSecure !== false,
        imapUser: profile.imapUser || '',
        imapPassword: '', // Never populate password from server
      });
      // Track if passwords exist in database
      setHasSmtpPassword(profile.hasSmtpPassword || false);
      setHasImapPassword(profile.hasImapPassword || false);
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to update email configuration');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Email configuration updated successfully');
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
    onError: () => {
      toast.error('Failed to update email configuration');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-6">
        <PageHeaderSkeleton />
        <Card>
          <CardContent className="pt-6">
            <FormSkeleton fields={6} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Email Configuration</h1>
        <p className="text-muted-foreground mt-2">
          Configure your SMTP and IMAP credentials for sending and receiving emails
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SMTP Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Send className="h-5 w-5" />
              <span>SMTP Configuration (Sending Emails)</span>
            </CardTitle>
            <CardDescription>
              Configure your SMTP server to send cold emails. Admin email ({session?.user?.email}) is only used for platform notifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-none">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                <strong>Required:</strong> You must configure your own SMTP credentials to send emails. This ensures better deliverability and keeps your sending reputation separate.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyEmail">Company Email *</Label>
              <Input
                id="companyEmail"
                type="email"
                value={formData.companyEmail}
                onChange={(e) => handleChange('companyEmail', e.target.value)}
                placeholder="contact@company.com"
                required
              />
              <p className="text-xs text-muted-foreground">
                This email will be used to send cold emails to leads
              </p>
            </div>

            <Separator className="my-4" />

            <div className="space-y-4">
              <h4 className="font-medium text-sm">SMTP Server Configuration</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP Host *</Label>
                  <Input
                    id="smtpHost"
                    value={formData.smtpHost}
                    onChange={(e) => handleChange('smtpHost', e.target.value)}
                    placeholder="smtp.gmail.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtpPort">SMTP Port *</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    value={formData.smtpPort}
                    onChange={(e) => handleChange('smtpPort', e.target.value)}
                    placeholder="587"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="smtpSecure"
                    checked={formData.smtpSecure}
                    onChange={(e) => handleChange('smtpSecure', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="smtpSecure" className="cursor-pointer text-sm">
                    Use SSL/TLS (Direct SSL on port 465)
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  ⚠️ <strong>Important:</strong> Uncheck this for port 587 (STARTTLS). Check only for port 465 (Direct SSL).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpUser">SMTP Username *</Label>
                  <Input
                    id="smtpUser"
                    value={formData.smtpUser}
                    onChange={(e) => handleChange('smtpUser', e.target.value)}
                    placeholder="your-email@gmail.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtpPassword">SMTP Password *</Label>
                  <div className="relative">
                    <Input
                      id="smtpPassword"
                      type={showSmtpPassword ? "text" : "password"}
                      value={formData.smtpPassword}
                      onChange={(e) => handleChange('smtpPassword', e.target.value)}
                      placeholder={hasSmtpPassword ? '••••••••• (saved - leave blank to keep)' : 'Enter password'}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      {showSmtpPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {hasSmtpPassword && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ✓ Password saved and encrypted
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpFrom">From Name (Optional)</Label>
                <Input
                  id="smtpFrom"
                  value={formData.smtpFrom}
                  onChange={(e) => handleChange('smtpFrom', e.target.value)}
                  placeholder="Your Name or Company Name"
                />
                <p className="text-xs text-muted-foreground">
                  This will be displayed as the sender name (e.g., "John Doe &lt;your@email.com&gt;")
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-none space-y-2">
                <p className="text-xs font-medium text-blue-900 dark:text-blue-100">Common SMTP Settings:</p>
                <div className="text-xs space-y-1 text-blue-800 dark:text-blue-200">
                  <div><strong>Gmail:</strong> smtp.gmail.com, Port 587, SSL OFF (STARTTLS)</div>
                  <div><strong>Outlook:</strong> smtp-mail.outlook.com, Port 587, SSL OFF (STARTTLS)</div>
                  <div><strong>Hostinger:</strong> smtp.hostinger.com, Port 587, SSL OFF (STARTTLS)</div>
                  <div><strong>Yahoo:</strong> smtp.mail.yahoo.com, Port 587, SSL OFF (STARTTLS)</div>
                  <div className="pt-1 border-t border-blue-300 dark:border-blue-800 mt-2"><strong>Note:</strong> Most providers use Port 587 with STARTTLS (SSL checkbox OFF)</div>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-none space-y-2 border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                  <span className="text-lg">🔑</span> Gmail Users - App Password Required
                </p>
                <div className="text-xs space-y-2 text-amber-800 dark:text-amber-200">
                  <p><strong>Gmail does NOT accept your regular password for SMTP.</strong> You must use an App Password:</p>
                  <ol className="list-decimal list-inside space-y-1 pl-2">
                    <li>Go to your Google Account: <a href="https://myaccount.google.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900 dark:hover:text-amber-100">myaccount.google.com</a></li>
                    <li>Click "Security" → "2-Step Verification" (enable if not already enabled)</li>
                    <li>Scroll down and click "App passwords"</li>
                    <li>Create a new app password (name it "LeadGen" or similar)</li>
                    <li>Copy the 16-character password and paste it in the SMTP Password field above</li>
                  </ol>
                  <p className="pt-2 border-t border-amber-200 dark:border-amber-800 font-medium">
                    ⚠️ Without an App Password, you'll get "Username and Password not accepted" error
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-none space-y-2">
              <p className="text-sm font-medium">Current Email for Sending:</p>
              <div className="text-sm text-muted-foreground">
                {formData.companyEmail || 'Not configured'}
              </div>
              {!formData.smtpHost && (
                <>
                  <Separator className="my-2" />
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ SMTP not configured. Please configure your SMTP settings above to send emails.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* IMAP Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Inbox className="h-5 w-5" />
              <span>IMAP Configuration (Receiving Replies)</span>
            </CardTitle>
            <CardDescription>
              Configure IMAP to automatically check for email replies from your leads
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="imapHost">IMAP Host *</Label>
                <Input
                  id="imapHost"
                  value={formData.imapHost}
                  onChange={(e) => handleChange('imapHost', e.target.value)}
                  placeholder="imap.gmail.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imapPort">IMAP Port *</Label>
                <Input
                  id="imapPort"
                  type="number"
                  value={formData.imapPort}
                  onChange={(e) => handleChange('imapPort', parseInt(e.target.value) || 993)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="imapSecure"
                  checked={formData.imapSecure}
                  onChange={(e) => handleChange('imapSecure', e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="imapSecure">Use SSL/TLS (Recommended)</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="imapUser">IMAP Username *</Label>
              <Input
                id="imapUser"
                value={formData.imapUser}
                onChange={(e) => handleChange('imapUser', e.target.value)}
                placeholder="your-email@domain.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imapPassword">IMAP Password *</Label>
              <div className="relative">
                <Input
                  id="imapPassword"
                  type={showImapPassword ? "text" : "password"}
                  value={formData.imapPassword}
                  onChange={(e) => handleChange('imapPassword', e.target.value)}
                  placeholder={hasImapPassword ? '••••••••• (saved - leave blank to keep)' : 'Enter password'}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowImapPassword(!showImapPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showImapPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {hasImapPassword && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  ✓ Password saved and encrypted
                </p>
              )}
              {!hasImapPassword && (
                <p className="text-xs text-muted-foreground">
                  Your password will be encrypted before storage.
                </p>
              )}
            </div>

            <div className="bg-green-50 dark:bg-green-950 p-3 rounded-none space-y-2">
              <p className="text-xs font-medium text-green-900 dark:text-green-100">Common IMAP Settings:</p>
              <div className="text-xs space-y-1 text-green-800 dark:text-green-200">
                <div><strong>Gmail:</strong> imap.gmail.com, Port 993, SSL (use App Password)</div>
                <div><strong>Outlook:</strong> outlook.office365.com, Port 993, SSL</div>
                <div><strong>Hostinger:</strong> imap.hostinger.com, Port 993, SSL</div>
                <div><strong>Yahoo:</strong> imap.mail.yahoo.com, Port 993, SSL</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          disabled={updateProfileMutation.isPending}
          className="w-full sm:w-auto"
        >
          {updateProfileMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

