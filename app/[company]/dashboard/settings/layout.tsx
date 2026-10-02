'use client'

import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardLink } from '@/components/navigation/dashboard-link'

/** Settings pages every staff member can use; the rest are workspace-admin only. */
const PERSONAL_SETTINGS = ['/settings/advanced', '/settings/integrations', '/settings/calendar']

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname() ?? ''
  const role = session?.user?.role
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'
  const personal = PERSONAL_SETTINGS.some((p) => pathname.endsWith(p))

  if (status !== 'loading' && !isAdmin && !personal) {
    // Company settings APIs are admin-only — show why instead of a page that can't load
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <ShieldCheck className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Admins only</h1>
        <p className="text-muted-foreground">
          Workspace settings are managed by your workspace admin. You can still change your own
          preferences.
        </p>
        <Button asChild>
          <DashboardLink href="/dashboard/settings/advanced">My settings</DashboardLink>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
