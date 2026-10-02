'use client';

import { useSession } from 'next-auth/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building, CreditCard, FileText, Info, Key, Palette, Slack, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SlackDestinations } from '@/components/settings/integrations/slack-destinations';
import { useUserProfileSettings } from '@/hooks/use-user-profile-settings';
import { FormSkeleton } from '@/components/loading';
import { BusinessTab } from './business-tab';
import { InvoicingTab } from './invoicing-tab';
import { PaymentTab } from './payment-tab';
import { TemplatesTab } from './templates-tab';
import { AiPersonalizationTab } from './ai-personalization-tab';
import { ApiKeysTab } from './api-keys-tab';

export default function UserProfileSettings() {
  const { data: session } = useSession();
  const settings = useUserProfileSettings();

  if (settings.isLoading) {
    return <FormSkeleton fields={6} withHeader />;
  }

  return (
    <div className="min-w-0 flex-1 space-y-6 pb-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Personal CRM settings</h1>
        <p className="text-sm text-muted-foreground">
          Invoicing templates, payment details, AI keys, and profile defaults for your account
          {session?.user?.email ? ` · ${session.user.email}` : ''}.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Workspace company identity is under Settings → Account. Integrations (email SMTP, Razorpay,
          calendar) live under Settings → Integrations. This page stores personal document branding and
          AI credentials on your user profile.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto no-scrollbar">
          <TabsTrigger value="profile" className="gap-2">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Business</span>
          </TabsTrigger>
          <TabsTrigger value="invoicing" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Invoicing</span>
          </TabsTrigger>
          <TabsTrigger value="payment" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Payment</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
          <TabsTrigger value="ai-personalization" className="gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">AI Setup</span>
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">API Keys</span>
          </TabsTrigger>
          <TabsTrigger value="slack-alerts" className="gap-2">
            <Slack className="h-4 w-4" />
            <span className="hidden sm:inline">Slack alerts</span>
          </TabsTrigger>
        </TabsList>

        <form onSubmit={settings.handleSubmit}>
          <BusinessTab {...settings} />
          <InvoicingTab {...settings} />
          <PaymentTab {...settings} />
          <TemplatesTab {...settings} />
          <AiPersonalizationTab {...settings} />
          <ApiKeysTab {...settings} />
        </form>

        {/* Outside the profile form: Slack alerts save on their own */}
        <TabsContent value="slack-alerts">
          <Card>
            <CardHeader>
              <CardTitle>Slack alerts</CardTitle>
              <CardDescription>
                Send your own notifications — assignments, mentions, comments, ticket updates —
                to Slack.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SlackDestinations scope="personal" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
