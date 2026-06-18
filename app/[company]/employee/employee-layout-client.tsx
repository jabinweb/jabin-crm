'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardSidebar from '@/components/layout/dashboard-sidebar'
import { TopBar } from '@/components/navigation/top-bar'
import { NAV_ITEMS, type NavItem } from '@/components/navigation/nav-items'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { resolvePostLoginPath } from '@/lib/auth/post-login-path'

function filterNavByModules(items: NavItem[], moduleMap: Record<string, boolean>) {
  return items.filter((item) => !item.module || moduleMap[item.module] === true)
}

export function EmployeeLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { employeePath } = useWorkspacePaths()
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

    if (session.user?.role !== 'EMPLOYEE') {
      router.push(
        resolvePostLoginPath({
          role: session.user.role,
          companySlug: (session.user as { companySlug?: string }).companySlug,
        })
      )
    }
  }, [session, status, router, employeePath])

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

  return (
    <div className="flex h-screen">
      {session?.user?.role === 'EMPLOYEE' && (
        <DashboardSidebar navItems={employeeNav} variant="employee" />
      )}
      <div className="flex-1 flex flex-col">
        {session?.user?.role === 'EMPLOYEE' && (
          <TopBar
            userRole="EMPLOYEE"
            title="Employee Dashboard"
            showMessages={true}
            navigationItems={topBarItems}
          />
        )}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
