'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Clock,
  CalendarDays,
  Wallet,
  Megaphone,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { format } from 'date-fns'

export function EssHome() {
  const { data: session } = useSession()
  const { employeePath, workspaceFetch } = useWorkspacePaths()
  const name = session?.user?.name?.split(' ')[0] || 'there'
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const { data: today } = useQuery({
    queryKey: ['ess-attendance-today'],
    queryFn: async () => {
      const res = await workspaceFetch('/api/employee/attendance/today')
      if (!res.ok) return null
      return res.json()
    },
  })

  const { data: balances = [] } = useQuery({
    queryKey: ['ess-leave-balances'],
    queryFn: async () => {
      const res = await workspaceFetch('/api/employee/leave/balances')
      if (!res.ok) return []
      return res.json()
    },
  })

  const { data: holidays = [] } = useQuery({
    queryKey: ['ess-holidays-upcoming'],
    queryFn: async () => {
      const res = await workspaceFetch('/api/employee/holidays?upcoming=1')
      if (!res.ok) return []
      return res.json()
    },
  })

  const { data: announcements = [] } = useQuery({
    queryKey: ['ess-announcements'],
    queryFn: async () => {
      const res = await workspaceFetch('/api/employee/announcements')
      if (!res.ok) return []
      return res.json()
    },
  })

  const punchedIn = Boolean(today?.checkIn && !today?.checkOut)
  const nextHoliday = Array.isArray(holidays) ? holidays[0] : null
  const latestAnnouncement = Array.isArray(announcements) ? announcements[0] : null

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white p-5 shadow-sm">
        <p className="text-sm text-white/70 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          {greeting}
        </p>
        <h1 className="text-2xl font-semibold mt-1">{name}</h1>
        <p className="text-sm text-white/70 mt-1">
          {format(new Date(), 'EEEE, d MMM')}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-white/10 p-3">
          <div>
            <p className="text-xs text-white/70">Today</p>
            <p className="font-medium">
              {punchedIn
                ? `In since ${today?.checkIn ? format(new Date(today.checkIn), 'h:mm a') : '—'}`
                : today?.checkOut
                  ? 'Shift complete'
                  : 'Not punched in'}
            </p>
          </div>
          <Button asChild size="sm" variant="secondary" className="shrink-0">
            <Link href={employeePath('/employee/attendance')}>
              {punchedIn ? 'Punch out' : 'Punch in'}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <QuickTile
          href={employeePath('/employee/attendance')}
          icon={Clock}
          label="Attendance"
          hint="Clock & history"
        />
        <QuickTile
          href={employeePath('/employee/leave')}
          icon={CalendarDays}
          label="Leave"
          hint="Request & balances"
        />
        <QuickTile
          href={employeePath('/employee/payslips')}
          icon={Wallet}
          label="Payslips"
          hint="Download PDF"
        />
        <QuickTile
          href={employeePath('/employee/announcements')}
          icon={Megaphone}
          label="Updates"
          hint="Announcements"
        />
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Leave balances</h2>
          <Link
            href={employeePath('/employee/leave')}
            className="text-xs text-primary flex items-center"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(balances as Array<{
            id: string
            entitled: number
            used: number
            pending: number
            policy: { name: string }
          }>).length === 0 ? (
            <Card className="shadow-none flex-1">
              <CardContent className="p-3 text-sm text-muted-foreground">
                Balances will appear after your first leave sync.
              </CardContent>
            </Card>
          ) : (
            (balances as Array<{
              id: string
              entitled: number
              used: number
              pending: number
              policy: { name: string }
            }>).map((b) => {
              const remaining = Math.max(0, b.entitled - b.used - b.pending)
              return (
                <Card key={b.id} className="shadow-none min-w-[140px]">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">{b.policy.name}</p>
                    <p className="text-2xl font-semibold mt-1">{remaining}</p>
                    <p className="text-[10px] text-muted-foreground">
                      of {b.entitled} days left
                    </p>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </section>

      {nextHoliday ? (
        <Card className="shadow-none">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Upcoming holiday</p>
              <p className="font-medium">{nextHoliday.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(nextHoliday.date), 'EEE, d MMM yyyy')}
              </p>
            </div>
            <Badge variant="secondary">{nextHoliday.type || 'PUBLIC'}</Badge>
          </CardContent>
        </Card>
      ) : null}

      {latestAnnouncement ? (
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs text-muted-foreground">Latest announcement</p>
              <Link
                href={employeePath('/employee/announcements')}
                className="text-xs text-primary"
              >
                All
              </Link>
            </div>
            <p className="font-medium line-clamp-1">{latestAnnouncement.title}</p>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {latestAnnouncement.content}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function QuickTile({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string
  icon: typeof Clock
  label: string
  hint: string
}) {
  return (
    <Link href={href}>
      <Card className="shadow-none h-full hover:bg-muted/40 transition-colors">
        <CardContent className="p-4">
          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Icon className="h-4 w-4" />
          </div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </Link>
  )
}
