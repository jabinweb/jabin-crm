'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import {
  User,
  Megaphone,
  MessageSquare,
  Activity,
  ChevronRight,
  LogOut,
  Users,
  FileText,
  CalendarClock,
  Timer,
  Receipt,
  Plane,
  DoorOpen,
  Briefcase,
  Target,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { signOut } from 'next-auth/react'
import { useFeatureModule } from '@/components/feature-module-guard'

type MoreItem = {
  href: string
  label: string
  hint: string
  icon: typeof User
}

export default function EmployeeMorePage() {
  const { data: session } = useSession()
  const { employeePath, path } = useWorkspacePaths()
  const leadsEnabled = useFeatureModule('LEADS')

  const { data: isManager } = useQuery({
    queryKey: ['is-manager'],
    queryFn: async () => {
      const res = await fetch('/api/manager/team')
      return res.ok
    },
  })

  const items: MoreItem[] = [
    {
      href: employeePath('/employee/profile'),
      label: 'My profile',
      hint: 'Personal details & emergency contact',
      icon: User,
    },
    {
      href: employeePath('/employee/documents'),
      label: 'My documents',
      hint: 'Your employee file',
      icon: FileText,
    },
    {
      href: employeePath('/employee/regularization'),
      label: 'Regularization',
      hint: 'Fix a missed or wrong punch',
      icon: CalendarClock,
    },
    {
      href: employeePath('/employee/timesheets'),
      label: 'Timesheets',
      hint: 'Log hours and submit your week',
      icon: Timer,
    },
    {
      href: employeePath('/employee/claims'),
      label: 'Claims & HR help',
      hint: 'Expenses, HR questions, policies',
      icon: Receipt,
    },
    {
      href: employeePath('/employee/performance'),
      label: 'Performance',
      hint: 'Goals & reviews',
      icon: Activity,
    },
    {
      href: employeePath('/employee/travel'),
      label: 'Travel requests',
      hint: 'Request and track business trips',
      icon: Plane,
    },
    {
      href: employeePath('/employee/exit'),
      label: 'Exit request',
      hint: 'Resignation & clearance',
      icon: DoorOpen,
    },
  ]

  if (isManager) {
    items.push({
      href: employeePath('/employee/team'),
      label: 'My team',
      hint: 'Attendance & leave approvals',
      icon: Users,
    })
  }

  items.push(
    {
      href: employeePath('/employee/announcements'),
      label: 'Announcements',
      hint: 'Company updates',
      icon: Megaphone,
    },
    {
      href: employeePath('/employee/messages'),
      label: 'Messages',
      hint: 'Team inbox',
      icon: MessageSquare,
    },
    {
      href: path('/dashboard/projects/my-work'),
      label: 'My project work',
      hint: 'Project tasks assigned to you',
      icon: Briefcase,
    }
  )

  if (leadsEnabled) {
    items.push({
      href: employeePath('/employee/leads'),
      label: 'My leads',
      hint: 'Leads and follow-ups assigned to you',
      icon: Target,
    })
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
      <EssPageHeader
        title="More"
        subtitle={session?.user?.email || 'Account & extras'}
      />
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className="block">
              <Card className="shadow-none hover:bg-muted/40 transition-colors">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.hint}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          )
        })}
        <button
          type="button"
          className="w-full"
          onClick={() => signOut({ callbackUrl: employeePath('/employee/login') })}
        >
          <Card className="shadow-none hover:bg-muted/40 transition-colors">
            <CardContent className="p-4 flex items-center gap-3 text-destructive">
              <div className="h-10 w-10 shrink-0 rounded-full bg-destructive/10 flex items-center justify-center">
                <LogOut className="h-4 w-4" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-sm">Sign out</p>
              </div>
            </CardContent>
          </Card>
        </button>
      </div>
    </div>
  )
}
