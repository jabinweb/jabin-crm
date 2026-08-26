'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardSidebar from '@/components/layout/dashboard-sidebar'
import { TopBar } from '@/components/navigation/top-bar'
import { NAV_ITEMS, type NavItem } from '@/components/navigation/nav-items'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { resolvePostLoginPath } from '@/lib/auth/post-login-path'
import { ShellSkeleton } from '@/components/loading'
import { EmployeeBottomNav } from '@/components/employee/mobile/bottom-nav'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

function filterNavByModules(items: NavItem[], moduleMap: Record<string, boolean>) {
  return items.filter((item) => !item.module || moduleMap[item.module] === true)
}

function canAccessEmployeePortal(session: {
  user?: { role?: string; employeeId?: string | null }
} | null) {
  if (!session?.user) return false
  if (session.user.role === 'EMPLOYEE') return true
  return Boolean(session.user.employeeId)
}

export function EmployeeLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { employeePath, path, slug } = useWorkspacePaths()
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
        href: item.href.startsWith('/dashboard')
          ? path(item.href)
          : employeePath(item.href),
        label: item.title,
        icon: item.icon,
      })),
    [employeeNav, employeePath, path]
  )

  const allowed = canAccessEmployeePortal(session)
  const initials = (session?.user?.name || 'E')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

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
          <>
            <div className="hidden lg:block shrink-0">
              <TopBar
                userRole="EMPLOYEE"
                title="Employee"
                showMessages={true}
                navigationItems={topBarItems}
              />
            </div>
            <header
              className="lg:hidden shrink-0 flex items-center justify-between px-4 pt-3 border-b bg-background/95"
              style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
            >
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  My HR
                </p>
                <p className="text-sm font-medium truncate max-w-[200px]">
                  {session?.user?.name || 'Employee'}
                </p>
              </div>
              <Link href={employeePath('/employee/profile')}>
                <Avatar className="h-9 w-9">
                  <AvatarImage src={session?.user?.image || undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
              </Link>
            </header>
          </>
        )}
        <main
          className="flex-1 min-h-0 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6"
          style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto w-full max-w-5xl lg:max-w-none">{children}</div>
        </main>
        {allowed ? <EmployeeBottomNav /> : null}
      </div>
    </div>
  )
}
