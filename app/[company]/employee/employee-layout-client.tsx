'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardSidebar from '@/components/layout/dashboard-sidebar'
import { TopBar } from '@/components/navigation/top-bar'
import { NAV_ITEMS, type NavItem } from '@/components/navigation/nav-items'

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
      router.push('/employee/login')
      return
    }

    if (session.user?.role !== 'EMPLOYEE') {
      router.push('/login')
      return
    }
  }, [session, status, router])

  const employeeNav = filterNavByModules(NAV_ITEMS.EMPLOYEE, moduleMap)

  return (
    <div className="flex h-screen">
      {session?.user?.role === 'EMPLOYEE' && (
        <DashboardSidebar navItems={employeeNav} />
      )}
      <div className="flex-1 flex flex-col">
        {session?.user?.role === 'EMPLOYEE' && (
          <TopBar 
            userRole="EMPLOYEE"
            title="Employee Dashboard"
            showMessages={true}
            navigationItems={employeeNav.map(item => ({
              href: item.href,
              label: item.title,
              icon: item.icon
            }))}
          />
        )}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
