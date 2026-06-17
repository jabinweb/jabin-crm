import type { NextRequest } from 'next/server'

export const AUTH_SESSION_COOKIE_NAMES = [
  '__Secure-authjs.session-token',
  'authjs.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
] as const

const SESSION_COOKIE_SET = new Set<string>(AUTH_SESSION_COOKIE_NAMES)

/** Remove auth session cookies from an incoming request (prevents OAuthAccountNotLinked). */
export function stripAuthSessionCookiesFromRequest(req: NextRequest): Headers {
  const requestHeaders = new Headers(req.headers)
  const cookie = requestHeaders.get('cookie')
  if (!cookie) return requestHeaders

  const filtered = cookie
    .split(';')
    .map((part) => part.trim())
    .filter((part) => {
      const name = part.split('=')[0]?.trim()
      return name && !SESSION_COOKIE_SET.has(name)
    })
    .join('; ')

  if (filtered) {
    requestHeaders.set('cookie', filtered)
  } else {
    requestHeaders.delete('cookie')
  }

  return requestHeaders
}

export function clearAuthSessionCookiesOnResponse(
  res: { cookies: { set: (name: string, value: string, options?: { maxAge?: number; path?: string }) => void } }
) {
  for (const name of AUTH_SESSION_COOKIE_NAMES) {
    res.cookies.set(name, '', { maxAge: 0, path: '/' })
  }
}
