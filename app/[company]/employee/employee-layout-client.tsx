'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardSidebar from '@/components/layout/dashboard-sidebar'
import { TopBar } from '@/components/navigation/top-bar'
import { NAV_ITEMS, type NavItem } from '@/components/navigation/nav-items'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { resolvePostLoginPath } from '@/lib/auth/post-login-path'
import { ShellSkeleton } from '@/components/loading'

function filterNavByModules(items: NavItem[], moduleMap: Record<string, boolean>) {
  return items.filter((item) => !item.module || moduleMap[item.module] === true)
}

function canAccessEmployeePortal(session: {
  user?: { role?: string; employeeId?: string | null }
} | null) {
  if (!session?.user) return false
  if (session.user.role === 'EMPLOYEE') return true
  // Linked staff (sales/tech/admin with an employee record) can use self-service HR pages.
  return Boolean(session.user.employeeId)
}

export function EmployeeLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { employeePath, slug } = useWorkspacePaths()
  const [moduleMap, setModuleMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/features/me')
      .then((res) => (res.ok ? res.json() : { modules: {} }))
      .then((data) => setModuleMap(data.modules ?? {}))
      .catch(() => setModuleMap({}))
  }, [])

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push(employeePath('/employee/login'))
      return
    }

    if (!canAccessEmployeePortal(session)) {
      router.push(
        resolvePostLoginPath({
          role: session.user?.role,
          companySlug:
            slug ||
            (session.user as { companySlug?: string })?.companySlug,
        })
      )
    }
  }, [session, status, router, employeePath, slug])

  const employeeNav = filterNavByModules(NAV_ITEMS.EMPLOYEE, moduleMap)

  const topBarItems = useMemo(
    () =>
      employeeNav.map((item) => ({
        href: employeePath(item.href),
        label: item.title,
        icon: item.icon,
      })),
    [employeeNav, employeePath]
  )

  const allowed = canAccessEmployeePortal(session)

  if (status === 'loading' || (session && !allowed)) {
    return <ShellSkeleton />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {allowed && (
        <aside className="hidden lg:flex shrink-0 h-full overflow-y-auto border-r">
          <DashboardSidebar navItems={employeeNav} variant="employee" />
        </aside>
      )}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {allowed && (
          <div className="shrink-0">
            <TopBar
              userRole="EMPLOYEE"
              title="Employee"
              showMessages={true}
              navigationItems={topBarItems}
            />
          </div>
        )}
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
