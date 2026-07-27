'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DashboardLink } from '@/components/navigation/dashboard-link'
import { useParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BasicInfoSection } from "./sections/basic-info"
import { CustomizationSection } from "./sections/customization"
import { NotificationsSection } from "./sections/notifications"
import { PaymentSection } from "./sections/payment"
import { SecuritySection } from "./sections/security"
import { WorkspaceSection } from "./sections/workspace"
import { SupportTicketTypesSection } from "./sections/support-ticket-types"
import { VisitTagsSection } from "./sections/visit-tags"
import { TerminologySection } from "./sections/terminology"
import { FieldOpsSection } from "./sections/field-ops"
import { SettingsProvider } from "@/contexts/settings-context"
import { SettingsLayout } from "../settings-layout"
import { useSettings } from "@/contexts/settings-context"
import type { CompanySettings, SettingsUpdatePayload } from '@/types/settings'

export function CompanySettings() {
  return (
    <SettingsProvider>
      <CompanySettingsContent />
    </SettingsProvider>
  )
}

function CompanySettingsContent() {
  const params = useParams<{ company: string }>()
  const [isDirty, setIsDirty] = useState(false)
  const { updateCompany, updateSettings, isUpdating, isLoading, fetchError, refetch } = useSettings()
  const [pendingChanges, setPendingChanges] = useState<SettingsUpdatePayload>({})

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading workspace settings…</p>
  }

  if (fetchError) {
    const code = (fetchError as Error & { code?: string }).code
    return (
      <Card className="border-amber-200 bg-amber-50/80">
        <CardHeader>
          <CardTitle className="text-amber-950">Could not load settings</CardTitle>
          <CardDescription className="text-amber-900/90">{fetchError.message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {code === 'NO_COMPANY' && params.company ? (
            <Button asChild>
              <Link href={`/${params.company}/register`}>Register a company</Link>
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  const handleSettingsChange = (changes: SettingsUpdatePayload) => {
    setPendingChanges(prev => ({
      company: { ...prev.company, ...changes.company },
      settings: { ...prev.settings, ...changes.settings }
    }))
    setIsDirty(true)
  }

  const handleSave = async () => {
    if (pendingChanges.company) {
      await updateCompany(pendingChanges.company)
    }
    if (pendingChanges.settings) {
      await updateSettings(pendingChanges.settings)
    }
    setIsDirty(false)
    setPendingChanges({})
  }

  return (
    <SettingsLayout 
      onSave={handleSave}
      isLoading={isUpdating}
      isDirty={isDirty}
    >
      <p className="text-sm text-muted-foreground">
        Workspace company details are stored on your{' '}
        <span className="font-medium text-foreground">Company</span> record. For personal CRM options (email
        integrations, AI API keys, legacy invoicing fields on your user profile), use{' '}
        <DashboardLink href="/dashboard/settings/advanced" className="text-primary underline-offset-4 hover:underline">
          personal CRM settings
        </DashboardLink>
        .
      </p>
      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 overflow-x-auto sm:flex-nowrap">
          <TabsTrigger value="basic" className="shrink-0">Basic Info</TabsTrigger>
          <TabsTrigger value="workspace" className="shrink-0">Business</TabsTrigger>
          <TabsTrigger value="customization" className="shrink-0">Customization</TabsTrigger>
          <TabsTrigger value="notifications" className="shrink-0">Notifications</TabsTrigger>
          <TabsTrigger value="payment" className="shrink-0">Payment</TabsTrigger>
          <TabsTrigger value="security" className="shrink-0">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <BasicInfoSection onChange={handleSettingsChange} />
        </TabsContent>
        <TabsContent value="workspace" className="space-y-6">
          <WorkspaceSection onChange={handleSettingsChange} />
          <TerminologySection onChange={handleSettingsChange} />
          <SupportTicketTypesSection onChange={handleSettingsChange} />
          <FieldOpsSection onChange={handleSettingsChange} />
          <VisitTagsSection />
        </TabsContent>
        <TabsContent value="customization">
          <CustomizationSection onChange={handleSettingsChange} />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsSection onChange={handleSettingsChange} />
        </TabsContent>
        <TabsContent value="payment">
          <PaymentSection onChange={handleSettingsChange} />
        </TabsContent>
        <TabsContent value="security">
          <SecuritySection onChange={handleSettingsChange} />
        </TabsContent>
      </Tabs>
    </SettingsLayout>
  )
}
