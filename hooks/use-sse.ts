'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import type { MessageAPIPayload } from '@/types/messages'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'unavailable'

interface SSEOptions {
  url?: string
  onMessage?: (event: MessageEvent) => void
  onError?: (error: Event) => void
  /** Default true */
  retry?: boolean
  /** Initial backoff ms (default 2000) */
  retryInterval?: number
  /** Cap backoff ms (default 60000) */
  maxRetryInterval?: number
  /** Stop retrying after this many consecutive failures (default 8) */
  maxRetries?: number
}

interface SSEHookReturn {
  status: ConnectionStatus
  send: (message: MessageAPIPayload) => void
  addHandler: (type: string, handler: (data: any) => void) => void
}

export function useSSE(options: SSEOptions = {}): SSEHookReturn {
  const { data: session } = useSession()
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const eventSourceRef = useRef<EventSource | null>(null)
  const handlersRef = useRef<Record<string, (data: any) => void>>({})
  const messageQueueRef = useRef<MessageAPIPayload[]>([])
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const attemptRef = useRef(0)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const send = useCallback(
    (message: MessageAPIPayload) => {
      if (status === 'connected') {
        fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        }).catch((error) => {
          console.error('[SSE] Send error:', error)
          messageQueueRef.current.push(message)
        })
      } else {
        messageQueueRef.current.push(message)
      }
    },
    [status]
  )

  const cleanupSource = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = undefined
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!session?.user) return

    const opts = optionsRef.current
    const retry = opts.retry !== false
    const baseInterval = opts.retryInterval ?? 2000
    const maxInterval = opts.maxRetryInterval ?? 60_000
    const maxRetries = opts.maxRetries ?? 8
    const url = opts.url ?? '/api/sse'

    cleanupSource()
    setStatus('connecting')

    try {
      const source = new EventSource(url)
      eventSourceRef.current = source

      source.onopen = () => {
        attemptRef.current = 0
        setStatus('connected')
        while (messageQueueRef.current.length > 0) {
          const msg = messageQueueRef.current.shift()
          if (msg) send(msg)
        }
      }

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { type?: string }
          if (data.type && handlersRef.current[data.type]) {
            handlersRef.current[data.type](data)
          }
          optionsRef.current.onMessage?.(event)
        } catch (error) {
          console.error('[SSE] Message parse error:', error)
        }
      }

      source.onerror = (event) => {
        source.close()
        eventSourceRef.current = null
        optionsRef.current.onError?.(event)

        if (!retry) {
          setStatus('unavailable')
          return
        }

        attemptRef.current += 1
        if (attemptRef.current > maxRetries) {
          setStatus('unavailable')
          console.warn('[SSE] Gave up after repeated failures (platform may not support long-lived SSE)')
          return
        }

        setStatus('disconnected')
        const delay = Math.min(maxInterval, baseInterval * 2 ** (attemptRef.current - 1))
        retryTimeoutRef.current = setTimeout(connect, delay)
      }
    } catch (error) {
      console.error('[SSE] Connect error:', error)
      setStatus('disconnected')
    }
  }, [session?.user, cleanupSource, send])

  useEffect(() => {
    if (session?.user) {
      connect()
    }
    return () => {
      cleanupSource()
    }
  }, [connect, cleanupSource, session?.user])

  const addHandler = useCallback((type: string, handler: (data: any) => void) => {
    handlersRef.current[type] = handler
  }, [])

  return {
    status,
    send,
    addHandler,
  }
}
