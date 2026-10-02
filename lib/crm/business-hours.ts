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

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

type ZonedParts = { y: number; mo: number; d: number; h: number; mi: number; weekday: number }

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    // Unknown/invalid timezone id — fall back to UTC
    return formatterFor('UTC')
  }
}

/** Wall-clock parts of an instant in the configured timezone (not the server's). */
function zonedParts(t: number, fmt: Intl.DateTimeFormat): ZonedParts & { s: number } {
  const p: Record<string, string> = {}
  for (const part of fmt.formatToParts(new Date(t))) p[part.type] = part.value
  return {
    y: Number(p.year),
    mo: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour) % 24,
    mi: Number(p.minute),
    s: Number(p.second),
    weekday: WEEKDAYS[p.weekday] ?? 0,
  }
}

function tzOffsetMs(t: number, fmt: Intl.DateTimeFormat): number {
  const p = zonedParts(t, fmt)
  const wallAsUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s)
  return wallAsUtc - Math.floor(t / 1000) * 1000
}

/** Instant for a wall-clock time in the configured timezone (day/hour overflow allowed). */
function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, fmt: Intl.DateTimeFormat): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const off1 = tzOffsetMs(guess, fmt)
  let t = guess - off1
  const off2 = tzOffsetMs(t, fmt)
  if (off2 !== off1) t = guess - off2
  return t
}

function dayKey(p: ZonedParts): string {
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}

/**
 * Add `hours` of business time onto `from`, skipping nights/weekends/holidays when enabled.
 * Opening hours, weekdays and holidays are evaluated in `config.timezone`.
 */
export function addBusinessHours(
  from: Date,
  hours: number,
  config: BusinessHoursConfig = DEFAULT_BUSINESS_HOURS
): Date {
  if (!config.enabled || hours <= 0) {
    return new Date(from.getTime() + hours * 60 * 60 * 1000)
  }

  const fmt = formatterFor(config.timezone || 'UTC')
  let remaining = hours * 60
  let cursor = from.getTime()
  const holidays = config.holidays || []
  let guard = 0

  while (remaining > 0 && guard < 10000) {
    guard++
    const p = zonedParts(cursor, fmt)
    const nextDay = () => zonedToUtc(p.y, p.mo, p.d + 1, 0, 0, fmt)
    const slot = config.weekly[p.weekday]
    if (!slot || holidays.includes(dayKey(p))) {
      cursor = nextDay()
      continue
    }

    const startMins = parseHm(slot.start)
    const endMins = parseHm(slot.end)
    const nowMins = p.h * 60 + p.mi

    const effectiveStart = Math.max(nowMins, startMins)
    if (effectiveStart >= endMins) {
      cursor = nextDay()
      continue
    }

    const available = endMins - effectiveStart
    const use = Math.min(available, remaining)
    const target = effectiveStart + use
    cursor = zonedToUtc(p.y, p.mo, p.d, Math.floor(target / 60), target % 60, fmt)
    remaining -= use
  }

  return new Date(cursor)
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
