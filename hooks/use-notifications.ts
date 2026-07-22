import { useState, useEffect, useCallback } from 'react'
import type { Notification } from '@/types/notifications'
import { toast } from '@/hooks/use-toast'
import { getDismissedNotifications, addDismissedNotification, isDismissed } from '@/lib/dismissed-notifications'

export function useNotifications(userRole: string) {
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
          'Pragma': 'no-cache'
        }
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
      
      // Filter out dismissed notifications
      const filteredNotifications = data.filter(
        (notification: Notification) => !isDismissed(notification.id)
      )
      
      setNotifications(filteredNotifications)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load notifications'
      console.error('Notification error:', message)
      setError(message)
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, []) // role comes from session server-side; no client role param

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
    } catch (error) {
      console.error('Mark as read error:', error)
    }
  }, [])

  const dismissNotification = useCallback((notificationId: string) => {
    addDismissedNotification(notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }, [])

  useEffect(() => {
    fetchNotifications()

    let es: EventSource | null = null
    try {
      es = new EventSource('/api/notifications/stream')
      es.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data)
          if (payload?.type === 'notifications') {
            // Refresh full feed when DB unread changes
            void fetch(`/api/notifications`, {
              headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
            })
              .then(async (response) => {
                if (!response.ok) return
                const data = await response.json()
                const filtered = (Array.isArray(data) ? data : []).filter(
                  (notification: Notification) => !isDismissed(notification.id)
                )
                setNotifications(filtered)
              })
              .catch(() => null)
          }
        } catch {
          /* ignore parse */
        }
      }
    } catch {
      es = null
    }

    const interval = setInterval(() => {
      void fetch(`/api/notifications`, {
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      })
        .then(async (response) => {
          if (response.status === 401) {
            setNotifications([])
            return
          }
          if (!response.ok) return
          const data = await response.json()
          const filtered = (Array.isArray(data) ? data : []).filter(
            (notification: Notification) => !isDismissed(notification.id)
          )
          setNotifications(filtered)
        })
        .catch(() => {
          /* ignore poll errors */
        })
    }, 45000)

    return () => {
      clearInterval(interval)
      es?.close()
    }
  }, [fetchNotifications])

  return {
    notifications,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    dismissNotification, // Add dismiss function
    unreadCount: notifications.filter(n => !n.read).length
  }
}
