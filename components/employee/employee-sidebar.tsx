'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Clock,
  DollarSign,
  Bell,
  User,
  MessageSquare,
} from 'lucide-react'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'

const routes = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/employee/dashboard',
  },
  {
    label: 'Profile',
    icon: User,
    href: '/employee/profile',
  },
  {
    label: 'Tasks',
    icon: ClipboardList,
    href: '/employee/tasks',
  },
  {
    label: 'Attendance',
    icon: Clock,
    href: '/employee/attendance',
  },
  {
    label: 'Leave',
    icon: Calendar,
    href: '/employee/leave',
  },
  {
    label: 'Payslips',
    icon: DollarSign,
    href: '/employee/payslips',
  },
  {
    label: 'Messages',
    icon: MessageSquare,
    href: '/employee/messages',
  },
  {
    label: 'Announcements',
    icon: Bell,
    href: '/employee/announcements',
  },
]

export function EmployeeSidebar() {
  const pathname = usePathname()
  const { employeePath } = useWorkspacePaths()

  return (
    <div className="space-y-4 py-4 flex flex-col h-full bg-white border-r">
      <div className="px-3 py-2">
        <h2 className="mb-2 px-4 text-lg font-semibold">Employee Portal</h2>
        <div className="space-y-1">
          {routes.map((route) => {
            const href = employeePath(route.href)
            return (
              <Link
                key={route.href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-none px-3 py-2 text-gray-500 transition-all hover:text-gray-900 hover:bg-gray-100',
                  pathname === href || pathname?.startsWith(href + '/')
                    ? 'bg-gray-100 text-gray-900'
                    : ''
                )}
              >
                <route.icon className="h-4 w-4" />
                {route.label}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
