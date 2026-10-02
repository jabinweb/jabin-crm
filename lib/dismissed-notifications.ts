interface DismissedNotification {
  id: string
  dismissedAt: number
}

const DISMISSED_KEY = 'dismissed_notifications'
const EXPIRY_DAYS = 30 // Notifications are dismissed for 30 days

/** Corrupt or unavailable storage (private mode, quota) must not break notifications. */
function readDismissed(): DismissedNotification[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is DismissedNotification =>
            !!item && typeof item.id === 'string' && typeof item.dismissedAt === 'number'
        )
      : []
  } catch {
    return []
  }
}

function writeDismissed(items: DismissedNotification[]) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

export function getDismissedNotifications(): string[] {
  if (typeof window === 'undefined') return []

  const dismissedItems = readDismissed()
  if (dismissedItems.length === 0) return []

  const now = Date.now()
  const validItems = dismissedItems.filter(item => {
    const age = now - item.dismissedAt
    return age < EXPIRY_DAYS * 24 * 60 * 60 * 1000
  })

  // Clean up expired items
  if (validItems.length !== dismissedItems.length) {
    writeDismissed(validItems)
  }

  return validItems.map(item => item.id)
}

export function addDismissedNotification(id: string) {
  if (typeof window === 'undefined') return
  const dismissedItems = readDismissed()

  if (!dismissedItems.some(item => item.id === id)) {
    dismissedItems.push({
      id,
      dismissedAt: Date.now()
    })
    writeDismissed(dismissedItems)
  }
}

export function isDismissed(id: string): boolean {
  return getDismissedNotifications().includes(id)
}
