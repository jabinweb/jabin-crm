'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EssPageHeader } from '@/components/employee/mobile/page-header'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns'
import { Loader2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { EssErrorState, humanizeStatus } from '@/components/employee/mobile/ess-states'

/** Calendar cell styling + short code per attendance status (legend below the grid). */
const DAY_STATUS: Record<string, { code: string; label: string; cell: string; swatch: string }> = {
  PRESENT: {
    code: 'P',
    label: 'Present',
    cell: 'bg-emerald-50 dark:bg-emerald-950/30',
    swatch: 'bg-emerald-500',
  },
  LATE: {
    code: 'LT',
    label: 'Late',
    cell: 'bg-emerald-50 dark:bg-emerald-950/30',
    swatch: 'bg-emerald-500',
  },
  HALF_DAY: {
    code: 'H',
    label: 'Half day',
    cell: 'bg-amber-50 dark:bg-amber-950/30',
    swatch: 'bg-amber-500',
  },
  ON_LEAVE: {
    code: 'L',
    label: 'On leave',
    cell: 'bg-amber-50 dark:bg-amber-950/30',
    swatch: 'bg-amber-500',
  },
  ABSENT: {
    code: 'A',
    label: 'Absent',
    cell: 'bg-rose-50 dark:bg-rose-950/20',
    swatch: 'bg-rose-500',
  },
}

type AttendanceRow = {
  id: string
  date?: string
  createdAt: string
  checkIn: string | null
  checkOut: string | null
  status: string
}

async function getGeo(): Promise<{ latitude?: number; longitude?: number; accuracy?: number }> {
  if (!navigator.geolocation) return {}
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  })
}

export default function AttendancePage() {
  const { workspaceFetch } = useWorkspacePaths()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [month] = useState(() => new Date())

  const { data: today, isLoading: todayLoading } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: async () => {
      const res = await workspaceFetch('/api/employee/attendance/today')
      if (!res.ok) return null
      return res.json()
    },
    refetchInterval: 30_000,
  })

  const {
    data: monthRows = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['attendance-month', month.getFullYear(), month.getMonth()],
    queryFn: async () => {
      const res = await workspaceFetch('/api/employee/attendance')
      if (!res.ok) throw new Error('Failed to load attendance')
      return (await res.json()) as AttendanceRow[]
    },
  })

  const punchedIn = Boolean(today?.checkIn && !today?.checkOut)
  const days = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    return eachDayOfInterval({ start, end })
  }, [month])

  const byDay = useMemo(() => {
    const map = new Map<string, AttendanceRow>()
    for (const row of monthRows) {
      // `date` is the attendance calendar day (UTC midnight); fall back to createdAt.
      const key = row.date ? row.date.slice(0, 10) : format(new Date(row.createdAt), 'yyyy-MM-dd')
      map.set(key, row)
    }
    return map
  }, [monthRows])

  const punch = async () => {
    setBusy(true)
    try {
      const geo = await getGeo()
      const endpoint = punchedIn
        ? '/api/employee/attendance/check-out'
        : '/api/employee/attendance/check-in'
      const res = await workspaceFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geo),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.error === 'string' ? body.error : "Couldn't record your punch. Please try again."
        )
      }
      if (body.outsideGeofence) {
        toast.warning(
          `${punchedIn ? 'Punched out' : 'Punched in'} — note: you were outside the office area.`
        )
      } else {
        toast.success(punchedIn ? 'Punched out' : 'Punched in')
      }
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-month'] })
      queryClient.invalidateQueries({ queryKey: ['ess-attendance-today'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't record your punch. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 lg:mx-0 lg:max-w-3xl">
      <EssPageHeader
        title="Attendance"
        subtitle={format(new Date(), 'EEEE, d MMMM')}
      />

      <Card className="shadow-none overflow-hidden">
        <CardContent className="p-4 space-y-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Status</p>
              {todayLoading ? (
                <Skeleton className="mt-1 h-6 w-32" />
              ) : (
                <p className="text-lg font-semibold">
                  {punchedIn ? 'On the clock' : today?.checkOut ? 'Completed' : 'Not punched in'}
                </p>
              )}
              {today?.checkIn ? (
                <p className="text-xs text-muted-foreground mt-1">
                  In {format(new Date(today.checkIn), 'h:mm a')}
                  {today.checkOut
                    ? ` · Out ${format(new Date(today.checkOut), 'h:mm a')}`
                    : ''}
                </p>
              ) : null}
            </div>
            {today?.status ? (
              <Badge variant={punchedIn ? 'default' : 'secondary'} className="shrink-0">
                {humanizeStatus(today.status)}
              </Badge>
            ) : null}
          </div>

          <Button
            className="w-full h-14 text-base rounded-xl"
            size="lg"
            disabled={busy || todayLoading || Boolean(today?.checkOut)}
            onClick={punch}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
                {punchedIn ? 'Punching out…' : 'Punching in…'}
              </>
            ) : punchedIn ? (
              'Punch out'
            ) : today?.checkOut ? (
              'Done for today'
            ) : (
              'Punch in'
            )}
          </Button>
          <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            Your location is recorded when you punch, if allowed.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-2 lg:max-w-lg" aria-labelledby="attendance-month-heading">
        <h2 id="attendance-month-heading" className="text-sm font-semibold">
          {format(month, 'MMMM yyyy')}
        </h2>
        {isLoading ? (
          <Skeleton className="aspect-[7/6] w-full rounded-lg" />
        ) : isError ? (
          <EssErrorState
            message="We couldn't load this month's attendance."
            onRetry={() => void refetch()}
          />
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div
                key={d}
                className="py-1 text-center text-[10px] font-medium text-muted-foreground"
                aria-hidden
              >
                {d.slice(0, 1)}
              </div>
            ))}
            {Array.from({ length: days[0].getDay() }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const row = byDay.get(key)
              const meta = row ? DAY_STATUS[row.status] : undefined
              const isToday = isSameDay(day, new Date())
              const label = row ? meta?.label ?? humanizeStatus(row.status) : 'No record'
              return (
                <div
                  key={key}
                  className={cn(
                    'flex aspect-square flex-col items-center justify-center rounded-lg border text-[11px]',
                    isToday && 'border-2 border-primary',
                    meta?.cell ?? 'bg-background'
                  )}
                  title={label}
                  aria-label={`${format(day, 'd MMMM')}: ${label}`}
                >
                  <span className="font-medium">{format(day, 'd')}</span>
                  {row ? (
                    <span className="text-[9px] leading-none text-muted-foreground">
                      {meta?.code ?? row.status.slice(0, 1)}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {Object.values(DAY_STATUS).map((s) => (
            <li key={s.code} className="flex items-center gap-1">
              <span className={cn('h-2 w-2 rounded-full', s.swatch)} aria-hidden />
              {s.code} = {s.label}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
