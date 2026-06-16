'use client'

import { useState } from 'react'
import Link from 'next/link'
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
import { SettingsProvider } from "@/contexts/settings-context"
import { SettingsLayout } from "../settings-layout"
import { useSettings } from "@/contexts/settings-context"
import type { CompanySettings, SettingsUpdatePayload } from '@/types/company-manager/settings'

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
        <Link href="/dashboard/settings/advanced" className="text-primary underline-offset-4 hover:underline">
          personal CRM settings
        </Link>
        .
      </p>
      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="workspace">Business</TabsTrigger>
          <TabsTrigger value="customization">Customization</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <BasicInfoSection onChange={handleSettingsChange} />
        </TabsContent>
        <TabsContent value="workspace">
          <WorkspaceSection onChange={handleSettingsChange} />
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
