'use client'

import { Suspense } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePathname, useRouter } from 'next/navigation'
import { TableSkeleton } from '@/components/table/table-skeleton'
import { FeatureModuleGuard } from '@/components/feature-module-guard'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'

const tabs = [
  { value: 'dashboard', label: 'Dashboard', path: '/employee/leads/dashboard' },
  { value: 'all', label: 'All Leads', path: '/employee/leads' },
  { value: 'active', label: 'Active', path: '/employee/leads/active' },
  { value: 'follow-up', label: 'Follow-ups', path: '/employee/leads/follow-up' },
] as const

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const { employeePath } = useWorkspacePaths()

  // Paths include the workspace slug, so match on the part after it
  const current =
    [...tabs]
      .sort((a, b) => b.path.length - a.path.length)
      .find((tab) => pathname.endsWith(tab.path))?.value ?? 'all'

  return (
    <FeatureModuleGuard module="LEADS" title="Leads not available">
      <div className="space-y-6">
        <Tabs
          value={current}
          onValueChange={(value) => {
            const tab = tabs.find((t) => t.value === value)
            if (tab) router.push(employeePath(tab.path), { scroll: false })
          }}
        >
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="animate-in fade-in-0 duration-200">
          <Suspense fallback={<TableSkeleton />}>{children}</Suspense>
        </div>
      </div>
    </FeatureModuleGuard>
  )
}
