'use client';

import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Save, Loader2, Send, Inbox, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { FormSkeleton } from '@/components/loading';

type EmailFormData = {
  companyEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapPassword: string;
};

const EMPTY_FORM: EmailFormData = {
  companyEmail: '',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPassword: '',
  smtpFrom: '',
  imapHost: '',
  imapPort: 993,
  imapSecure: true,
  imapUser: '',
  imapPassword: '',
};

interface EmailIntegrationFormProps {
  /** Hide page-style chrome when embedded in Integrations hub. */
  embedded?: boolean;
  onSaved?: () => void;
}

export function EmailIntegrationForm({ embedded = false, onSaved }: EmailIntegrationFormProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [showImapPassword, setShowImapPassword] = useState(false);
  const [hasSmtpPassword, setHasSmtpPassword] = useState(false);
  const [hasImapPassword, setHasImapPassword] = useState(false);
  const [formData, setFormData] = useState<EmailFormData>(EMPTY_FORM);

  const { data: profile, isPending } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await fetch('/api/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
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
        smtpPassword: '',
        smtpFrom: profile.smtpFrom || '',
        imapHost: profile.imapHost || '',
        imapPort: profile.imapPort || 993,
        imapSecure: profile.imapSecure !== false,
        imapUser: profile.imapUser || '',
        imapPassword: '',
      });
      setHasSmtpPassword(profile.hasSmtpPassword || false);
      setHasImapPassword(profile.hasImapPassword || false);
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: EmailFormData) => {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update email configuration');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Email configuration updated');
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['company-integrations'] });
      onSaved?.();
    },
    onError: () => {
      toast.error('Failed to update email configuration');
    },
  });

  const handleChange = (field: keyof EmailFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Only one loader: first load with no cached profile.
  if (isPending && !profile) {
    return <FormSkeleton fields={embedded ? 4 : 6} />;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        updateProfileMutation.mutate(formData);
      }}
      className="space-y-6"
    >
      {embedded ? (
        <p className="text-xs text-muted-foreground">
          Stored on your admin profile — used for outreach, quotes, and invoice email from this
          workspace.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4" />
            SMTP (sending)
          </CardTitle>
          <CardDescription>
            Send from your company mailbox. Platform login ({session?.user?.email}) is only for
            Opslane notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyEmail">Company email</Label>
            <Input
              id="companyEmail"
              type="email"
              value={formData.companyEmail}
              onChange={(e) => handleChange('companyEmail', e.target.value)}
              placeholder="contact@company.com"
              required
            />
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtpHost">SMTP host</Label>
              <Input
                id="smtpHost"
                value={formData.smtpHost}
                onChange={(e) => handleChange('smtpHost', e.target.value)}
                placeholder="smtp.gmail.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort">SMTP port</Label>
              <Input
                id="smtpPort"
                type="number"
                value={formData.smtpPort}
                onChange={(e) => handleChange('smtpPort', Number(e.target.value) || 587)}
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="smtpSecure"
              checked={formData.smtpSecure}
              onChange={(e) => handleChange('smtpSecure', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="smtpSecure" className="cursor-pointer text-sm font-normal">
              Direct SSL (port 465 only)
            </Label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtpUser">SMTP username</Label>
              <Input
                id="smtpUser"
                value={formData.smtpUser}
                onChange={(e) => handleChange('smtpUser', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPassword">SMTP password</Label>
              <div className="relative">
                <Input
                  id="smtpPassword"
                  type={showSmtpPassword ? 'text' : 'password'}
                  value={formData.smtpPassword}
                  onChange={(e) => handleChange('smtpPassword', e.target.value)}
                  placeholder={hasSmtpPassword ? 'Leave blank to keep saved' : undefined}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtpFrom">From name (optional)</Label>
            <Input
              id="smtpFrom"
              value={formData.smtpFrom}
              onChange={(e) => handleChange('smtpFrom', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-4 w-4" />
            IMAP (replies)
          </CardTitle>
          <CardDescription>Pull lead replies into the outreach inbox.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="imapHost">IMAP host</Label>
              <Input
                id="imapHost"
                value={formData.imapHost}
                onChange={(e) => handleChange('imapHost', e.target.value)}
                placeholder="imap.gmail.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imapPort">IMAP port</Label>
              <Input
                id="imapPort"
                type="number"
                value={formData.imapPort}
                onChange={(e) => handleChange('imapPort', parseInt(e.target.value, 10) || 993)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="imapSecure"
              checked={formData.imapSecure}
              onChange={(e) => handleChange('imapSecure', e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="imapSecure" className="font-normal">
              Use SSL/TLS
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="imapUser">IMAP username</Label>
            <Input
              id="imapUser"
              value={formData.imapUser}
              onChange={(e) => handleChange('imapUser', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="imapPassword">IMAP password</Label>
            <div className="relative">
              <Input
                id="imapPassword"
                type={showImapPassword ? 'text' : 'password'}
                value={formData.imapPassword}
                onChange={(e) => handleChange('imapPassword', e.target.value)}
                placeholder={hasImapPassword ? 'Leave blank to keep saved' : undefined}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowImapPassword(!showImapPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showImapPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={updateProfileMutation.isPending}>
        {updateProfileMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Save email settings
          </>
        )}
      </Button>
    </form>
  );
}
