'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Notification } from '@/types/notifications'
import { toast } from '@/hooks/use-toast'
import { addDismissedNotification, isDismissed } from '@/lib/dismissed-notifications'
import { useRealtime } from '@/hooks/use-realtime'
import { REALTIME_EVENTS } from '@/lib/realtime/events'
import { useSession } from 'next-auth/react'

export function useNotifications(_userRole: string) {
  const { data: session } = useSession()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/notifications`, {
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      })

      if (response.status === 401) {
        setNotifications([])
        setError(null)
        return
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.status}`)
      }

      const data = await response.json()
      const filteredNotifications = (Array.isArray(data) ? data : []).filter(
        (notification: Notification) => !isDismissed(notification.id)
      )
      setNotifications(filteredNotifications)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load notifications'
      console.error('Notification error:', message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      addDismissedNotification(notificationId)
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markAsRead',
          notificationId,
        }),
      })
    } catch (err) {
      console.error('Mark as read error:', err)
    }
  }, [])

  const dismissNotification = useCallback((notificationId: string) => {
    addDismissedNotification(notificationId)
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
  }, [])

  useEffect(() => {
    void fetchNotifications()
    const interval = setInterval(() => {
      void fetchNotifications()
    }, 120_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  useRealtime({
    types: [REALTIME_EVENTS.NOTIFICATION_CREATED],
    onEvent: (e) => {
      const myId = session?.user?.id
      if (e.userId && myId && e.userId !== myId) return
      void fetchNotifications()
      const title =
        typeof e.payload?.title === 'string' ? e.payload.title : 'New notification'
      const description =
        typeof e.payload?.body === 'string' ? e.payload.body : undefined
      toast({ title, description })
    },
  })

  return {
    notifications,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    dismissNotification,
    unreadCount: notifications.filter((n) => !n.read).length,
  }
}
