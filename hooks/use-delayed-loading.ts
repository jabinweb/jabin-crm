'use client'

import { useEffect, useState } from 'react'

/**
 * Avoid skeleton flash when fetches resolve quickly.
 * Returns true only after `delayMs` of continuous loading.
 */
export function useDelayedLoading(isLoading: boolean, delayMs = 180): boolean {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setShow(false)
      return
    }
    const id = window.setTimeout(() => setShow(true), delayMs)
    return () => window.clearTimeout(id)
  }, [isLoading, delayMs])

  return isLoading && show
}
