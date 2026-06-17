'use client'

import { signIn, signOut } from 'next-auth/react'

/** Clear stale session, then start Google OAuth without losing the redirect URL. */
export async function startGoogleSignIn(callbackUrl: string) {
  await signOut({ redirect: false })
  const result = await signIn('google', { callbackUrl, redirect: false })
  if (result?.url) {
    window.location.assign(result.url)
    return
  }
  if (result?.error) {
    throw new Error(result.error)
  }
}
