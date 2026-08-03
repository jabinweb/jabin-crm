'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Clock, CalendarDays, Wallet, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'

const TABS = [
  { href: '/employee/dashboard', label: 'Home', icon: Home },
  { href: '/employee/attendance', label: 'Attendance', icon: Clock },
  { href: '/employee/leave', label: 'Leave', icon: CalendarDays },
  { href: '/employee/payslips', label: 'Payslips', icon: Wallet },
  { href: '/employee/more', label: 'More', icon: Menu },
] as const

export function EmployeeBottomNav() {
  const pathname = usePathname()
  const { employeePath } = useWorkspacePaths()

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1 pt-1">
        {TABS.map((tab) => {
          const href = employeePath(tab.href)
          const active =
            tab.href === '/employee/dashboard'
              ? pathname?.endsWith('/employee/dashboard') ||
                pathname?.endsWith('/employee') ||
                pathname?.match(/\/employee\/?$/)
              : pathname?.includes(tab.href)
          const Icon = tab.icon
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.5px]')} />
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
