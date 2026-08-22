/** Business-hours aware SLA time addition. */

export type WeeklyHours = {
  /** 0=Sun … 6=Sat → { start: "09:00", end: "18:00" } or null if closed */
  [day: number]: { start: string; end: string } | null
}

export type BusinessHoursConfig = {
  enabled: boolean
  timezone?: string
  weekly: WeeklyHours
  /** ISO date strings YYYY-MM-DD that are holidays (no SLA clock) */
  holidays?: string[]
}

export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  enabled: false,
  timezone: 'Asia/Kolkata',
  weekly: {
    0: null,
    1: { start: '09:00', end: '18:00' },
    2: { start: '09:00', end: '18:00' },
    3: { start: '09:00', end: '18:00' },
    4: { start: '09:00', end: '18:00' },
    5: { start: '09:00', end: '18:00' },
    6: null,
  },
  holidays: [],
}

function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map((x) => parseInt(x, 10))
  return (h || 0) * 60 + (m || 0)
}

function isHoliday(d: Date, holidays: string[]): boolean {
  const key = d.toISOString().slice(0, 10)
  return holidays.includes(key)
}

/** Add `hours` of business time onto `from`, skipping nights/weekends/holidays when enabled. */
export function addBusinessHours(
  from: Date,
  hours: number,
  config: BusinessHoursConfig = DEFAULT_BUSINESS_HOURS
): Date {
  if (!config.enabled || hours <= 0) {
    return new Date(from.getTime() + hours * 60 * 60 * 1000)
  }

  let remaining = hours * 60
  const cursor = new Date(from)
  const holidays = config.holidays || []
  let guard = 0

  while (remaining > 0 && guard < 10000) {
    guard++
    const day = cursor.getDay()
    const slot = config.weekly[day]
    if (!slot || isHoliday(cursor, holidays)) {
      cursor.setDate(cursor.getDate() + 1)
      cursor.setHours(0, 0, 0, 0)
      continue
    }

    const startMins = parseHm(slot.start)
    const endMins = parseHm(slot.end)
    const nowMins = cursor.getHours() * 60 + cursor.getMinutes()

    if (nowMins >= endMins) {
      cursor.setDate(cursor.getDate() + 1)
      cursor.setHours(0, 0, 0, 0)
      continue
    }

    const effectiveStart = Math.max(nowMins, startMins)
    if (effectiveStart >= endMins) {
      cursor.setDate(cursor.getDate() + 1)
      cursor.setHours(0, 0, 0, 0)
      continue
    }

    const available = endMins - effectiveStart
    const use = Math.min(available, remaining)
    const h = Math.floor(effectiveStart / 60)
    const m = effectiveStart % 60
    cursor.setHours(h, m, 0, 0)
    cursor.setMinutes(cursor.getMinutes() + use)
    remaining -= use
  }

  return cursor
}

export function parseBusinessHoursFromSettings(settings: unknown): BusinessHoursConfig {
  if (!settings || typeof settings !== 'object') return DEFAULT_BUSINESS_HOURS
  const bh = (settings as { businessHours?: BusinessHoursConfig }).businessHours
  if (!bh || typeof bh !== 'object') return DEFAULT_BUSINESS_HOURS
  return {
    ...DEFAULT_BUSINESS_HOURS,
    ...bh,
    weekly: { ...DEFAULT_BUSINESS_HOURS.weekly, ...(bh.weekly || {}) },
  }
}
