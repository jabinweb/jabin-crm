'use client'

import { createContext, useContext, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface SessionContextValue {
  status: 'loading' | 'authenticated' | 'unauthenticated'
}

const SessionContext = createContext<SessionContextValue>({
  status: 'loading'
})

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      // Skip session check for public routes
      const publicRoutes = ['/', '/auth/signin', '/auth/register', '/register', '/workspace']
      const currentPath = window.location.pathname
      
      if (publicRoutes.includes(currentPath) || currentPath.startsWith('/auth/') || currentPath.startsWith('/.well-known/')) {
        return
      }

      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()

        console.log('[SessionProvider] Session check:', {
          success: !!data.user,
          timestamp: new Date().toISOString()
        })

        if (!data.user) {
          router.push('/auth/signin')
        }
      } catch (error) {
        console.error('[SessionProvider] Session check error:', error)
        router.push('/auth/signin')
      }
    }

    checkSession()

    // Check session every 5 minutes
    const interval = setInterval(checkSession, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [router])

  return <SessionContext.Provider value={{ status: 'loading' }}>{children}</SessionContext.Provider>
}

export const useSessionContext = () => useContext(SessionContext)
