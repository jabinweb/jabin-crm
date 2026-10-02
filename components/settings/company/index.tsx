'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DashboardLink } from '@/components/navigation/dashboard-link'
import { useParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BasicInfoSection } from "./sections/basic-info"
import { PaymentSection } from "./sections/payment"
import { WorkspaceSection } from "./sections/workspace"
import { SupportTicketTypesSection } from "./sections/support-ticket-types"
import { VisitTagsSection } from "./sections/visit-tags"
import { ProjectTaskStatusesSection } from "./sections/project-task-statuses"
import { TerminologySection } from "./sections/terminology"
import { FieldOpsSection } from "./sections/field-ops"
import { CompanyDatabasePanel } from "./sections/database"
import { SettingsProvider, SettingsDraftProvider, useSettings } from "@/contexts/settings-context"
import { SettingsLayout } from "../settings-layout"
import { FormSkeleton } from '@/components/loading'
import type { SettingsUpdatePayload } from '@/types/settings'

import {
  SETTINGS_TAB_LIST_CLASS as TAB_LIST_CLASS,
  SETTINGS_TAB_TRIGGER_CLASS as TAB_TRIGGER_CLASS,
} from '../settings-tab-styles'

export function CompanySettings() {
  return (
    <SettingsProvider>
      <CompanySettingsContent />
    </SettingsProvider>
  )
}

function CompanySettingsHeader() {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Workspace settings</h1>
      <p className="text-sm text-muted-foreground">
        Company profile, business type, and workspace defaults. Connect payments, WhatsApp, email,
        and webhooks in{' '}
        <DashboardLink
          href="/dashboard/settings/integrations"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Integrations
        </DashboardLink>
        ; your own email and AI keys live in{' '}
        <DashboardLink
          href="/dashboard/settings/advanced"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          My settings
        </DashboardLink>
        .
      </p>
    </div>
  )
}

function CompanySettingsContent() {
  const params = useParams<{ company: string }>()
  const { updateCompany, updateSettings, isUpdating, isLoading, fetchError, refetch } = useSettings()
  const [pendingChanges, setPendingChanges] = useState<SettingsUpdatePayload>({})
  const isDirty = !!(pendingChanges.company || pendingChanges.settings)

  if (isLoading) {
    return (
      <div className="min-w-0 space-y-6">
        <CompanySettingsHeader />
        <FormSkeleton fields={6} />
      </div>
    )
  }

  if (fetchError) {
    const code = (fetchError as Error & { code?: string }).code
    return (
      <div className="min-w-0 space-y-6">
        <CompanySettingsHeader />
        <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/30">
          <CardHeader>
            <CardTitle className="text-base">Could not load settings</CardTitle>
            <CardDescription>{fetchError.message}</CardDescription>
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
      </div>
    )
  }

  // Each section sends whole top-level keys built from the draft view, so a shallow merge
  // keeps every staged edit (a later section can no longer clobber an earlier one).
  const handleSettingsChange = (changes: SettingsUpdatePayload) => {
    setPendingChanges((prev) => ({
      company: changes.company ? { ...prev.company, ...changes.company } : prev.company,
      settings: changes.settings ? { ...prev.settings, ...changes.settings } : prev.settings,
    }))
  }

  const handleSave = async () => {
    try {
      if (pendingChanges.company) {
        await updateCompany(pendingChanges.company)
      }
      if (pendingChanges.settings) {
        await updateSettings(pendingChanges.settings)
      }
      setPendingChanges({})
    } catch {
      // The settings context already shows an error toast; keep the edits so they can retry.
    }
  }

  return (
    <SettingsDraftProvider
      draft={pendingChanges as { company?: Record<string, unknown>; settings?: Record<string, unknown> }}
    >
      <SettingsLayout
        onSave={handleSave}
        onCancel={() => setPendingChanges({})}
        isLoading={isUpdating}
        isDirty={isDirty}
      >
        <CompanySettingsHeader />
        <Tabs defaultValue="basic" className="space-y-4">
          <TabsList className={TAB_LIST_CLASS}>
            <TabsTrigger value="basic" className={TAB_TRIGGER_CLASS}>Basic info</TabsTrigger>
            <TabsTrigger value="workspace" className={TAB_TRIGGER_CLASS}>Business</TabsTrigger>
            <TabsTrigger value="payment" className={TAB_TRIGGER_CLASS}>Currency & payments</TabsTrigger>
            <TabsTrigger value="database" className={TAB_TRIGGER_CLASS}>Database</TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <BasicInfoSection onChange={handleSettingsChange} />
          </TabsContent>
          <TabsContent value="workspace" className="space-y-6">
            <WorkspaceSection onChange={handleSettingsChange} />
            <TerminologySection onChange={handleSettingsChange} />
            <SupportTicketTypesSection onChange={handleSettingsChange} />
            <ProjectTaskStatusesSection onChange={handleSettingsChange} />
            <FieldOpsSection onChange={handleSettingsChange} />
            <VisitTagsSection />
          </TabsContent>
          <TabsContent value="payment">
            <PaymentSection onChange={handleSettingsChange} />
          </TabsContent>
          <TabsContent value="database">
            <CompanyDatabasePanel />
          </TabsContent>
        </Tabs>
      </SettingsLayout>
    </SettingsDraftProvider>
  )
}
