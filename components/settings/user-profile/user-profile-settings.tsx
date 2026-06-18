'use client';

import { useSession } from 'next-auth/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building, FileText, Info, Key, Loader2, Sparkles } from 'lucide-react';
import { useUserProfileSettings } from '@/hooks/use-user-profile-settings';
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
    return (
      <div className="flex-1 space-y-4">
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 pb-8">
      <div className="border-b pb-6 mb-8 mt-2">
        <h2 className="text-xl font-black uppercase tracking-[0.2em]">Core Configuration</h2>
        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-2 tracking-widest opacity-60">
          User ID: {session?.user?.id?.slice(-8).toUpperCase()} • System Parameters
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Workspace company identity (the shared team record) is edited under your tenant URL, for example
          /your-company/dashboard/settings. This screen updates your personal user profile: email integrations,
          AI API keys, and related fields stored on your account.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full max-w-full grid-cols-6">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Business</span>
            <span className="sm:hidden">Info</span>
          </TabsTrigger>
          <TabsTrigger value="invoicing" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Invoicing</span>
            <span className="sm:hidden">Invoice</span>
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="hidden sm:inline">Payment</span>
            <span className="sm:hidden">Pay</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            <span className="hidden sm:inline">Templates</span>
            <span className="sm:hidden">Theme</span>
          </TabsTrigger>
          <TabsTrigger value="ai-personalization" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">AI Setup</span>
            <span className="sm:hidden">AI</span>
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">API Keys</span>
            <span className="sm:hidden">Keys</span>
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
      </Tabs>
    </div>
  );
}
