'use client';

import { useSession } from 'next-auth/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Building, CreditCard, FileText, Info, Key, Palette, Slack, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SlackDestinations } from '@/components/settings/integrations/slack-destinations';
import { McpTokens } from '@/components/settings/integrations/mcp-tokens';
import { useUserProfileSettings } from '@/hooks/use-user-profile-settings';
import { FormSkeleton } from '@/components/loading';
import { SETTINGS_TAB_LIST_CLASS, SETTINGS_TAB_TRIGGER_CLASS } from '../settings-tab-styles';
import { BusinessTab } from './business-tab';
import { InvoicingTab } from './invoicing-tab';
import { PaymentTab } from './payment-tab';
import { TemplatesTab } from './templates-tab';
import { AiPersonalizationTab } from './ai-personalization-tab';
import { ApiKeysTab } from './api-keys-tab';

function MySettingsHeader({ email }: { email?: string | null }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">My settings</h1>
      <p className="text-sm text-muted-foreground">
        Your invoicing templates, payment details, AI keys, and alerts
        {email ? ` · ${email}` : ''}.
      </p>
    </div>
  );
}

export default function UserProfileSettings() {
  const { data: session } = useSession();
  const settings = useUserProfileSettings();

  if (settings.isLoading) {
    // Static title shows right away; only the form waits for data
    return (
      <div className="min-w-0 flex-1 space-y-6 pb-8">
        <MySettingsHeader email={session?.user?.email} />
        <FormSkeleton fields={6} />
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 space-y-6 pb-8">
      <MySettingsHeader email={session?.user?.email} />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          These settings apply to your account only. Company details and shared integrations
          (email, Razorpay, calendar) are managed by workspace admins under Settings.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className={SETTINGS_TAB_LIST_CLASS}>
          <TabsTrigger value="profile" className={SETTINGS_TAB_TRIGGER_CLASS}>
            <Building className="h-4 w-4" aria-hidden />
            <span>Business</span>
          </TabsTrigger>
          <TabsTrigger value="invoicing" className={SETTINGS_TAB_TRIGGER_CLASS}>
            <FileText className="h-4 w-4" />
            <span>Invoicing</span>
          </TabsTrigger>
          <TabsTrigger value="payment" className={SETTINGS_TAB_TRIGGER_CLASS}>
            <CreditCard className="h-4 w-4" />
            <span>Payment</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className={SETTINGS_TAB_TRIGGER_CLASS}>
            <Palette className="h-4 w-4" />
            <span>Templates</span>
          </TabsTrigger>
          <TabsTrigger value="ai-personalization" className={SETTINGS_TAB_TRIGGER_CLASS}>
            <Sparkles className="h-4 w-4" />
            <span>AI setup</span>
          </TabsTrigger>
          <TabsTrigger value="api-keys" className={SETTINGS_TAB_TRIGGER_CLASS}>
            <Key className="h-4 w-4" />
            <span>API keys</span>
          </TabsTrigger>
          <TabsTrigger value="slack-alerts" className={SETTINGS_TAB_TRIGGER_CLASS}>
            <Slack className="h-4 w-4" />
            <span>Slack alerts</span>
          </TabsTrigger>
          <TabsTrigger value="mcp" className={SETTINGS_TAB_TRIGGER_CLASS}>
            <Bot className="h-4 w-4" />
            <span>AI clients (MCP)</span>
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

        {/* Outside the profile form: tokens save on their own */}
        <TabsContent value="mcp">
          <Card>
            <CardHeader>
              <CardTitle>AI clients (MCP)</CardTitle>
              <CardDescription>
                Use Opslane from Claude, Cursor and other MCP clients with your own permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <McpTokens />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
