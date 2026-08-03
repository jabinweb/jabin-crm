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

type AttendanceRow = {
  id: string
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

  const { data: monthRows = [], isLoading } = useQuery({
    queryKey: ['attendance-month', month.getFullYear(), month.getMonth()],
    queryFn: async () => {
      const res = await workspaceFetch('/api/employee/attendance')
      if (!res.ok) return []
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
      const key = format(new Date(row.createdAt), 'yyyy-MM-dd')
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
        throw new Error(typeof body.error === 'string' ? body.error : 'Punch failed')
      }
      if (body.outsideGeofence) {
        toast.warning('Punched outside office geo-fence')
      } else {
        toast.success(punchedIn ? 'Punched out' : 'Punched in')
      }
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-month'] })
      queryClient.invalidateQueries({ queryKey: ['ess-attendance-today'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Punch failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <EssPageHeader
        title="Attendance"
        subtitle={format(new Date(), 'EEEE, d MMMM')}
      />

      <Card className="shadow-none overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-lg font-semibold">
                {todayLoading
                  ? '…'
                  : punchedIn
                    ? 'On the clock'
                    : today?.checkOut
                      ? 'Completed'
                      : 'Not punched in'}
              </p>
              {today?.checkIn ? (
                <p className="text-xs text-muted-foreground mt-1">
                  In {format(new Date(today.checkIn), 'h:mm a')}
                  {today.checkOut
                    ? ` · Out ${format(new Date(today.checkOut), 'h:mm a')}`
                    : ''}
                </p>
              ) : null}
            </div>
            <Badge variant={punchedIn ? 'default' : 'secondary'}>
              {today?.status || '—'}
            </Badge>
          </div>

          <Button
            className="w-full h-14 text-base rounded-xl"
            size="lg"
            disabled={busy || Boolean(today?.checkOut)}
            onClick={punch}
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : punchedIn ? (
              'Punch out'
            ) : today?.checkOut ? (
              'Done for today'
            ) : (
              'Punch in'
            )}
          </Button>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 justify-center">
            <MapPin className="h-3 w-3" />
            Uses GPS when available (geo-fence may apply)
          </p>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{format(month, 'MMMM yyyy')}</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
              <div
                key={d}
                className="text-center text-[10px] text-muted-foreground font-medium py-1"
              >
                {d}
              </div>
            ))}
            {Array.from({ length: days[0].getDay() }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const row = byDay.get(key)
              const isToday = isSameDay(day, new Date())
              return (
                <div
                  key={key}
                  className={cn(
                    'aspect-square rounded-lg border flex flex-col items-center justify-center text-[11px]',
                    isToday && 'border-primary',
                    row?.status === 'PRESENT' || row?.status === 'LATE'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30'
                      : row?.status === 'ON_LEAVE' || row?.status === 'HALF_DAY'
                        ? 'bg-amber-50 dark:bg-amber-950/30'
                        : row?.status === 'ABSENT'
                          ? 'bg-rose-50 dark:bg-rose-950/20'
                          : 'bg-background'
                  )}
                  title={row?.status || 'No record'}
                >
                  <span className="font-medium">{format(day, 'd')}</span>
                  {row ? (
                    <span className="text-[8px] text-muted-foreground leading-none">
                      {row.status.slice(0, 1)}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          P = present · L = leave · A = absent
        </p>
      </section>
    </div>
  )
}
