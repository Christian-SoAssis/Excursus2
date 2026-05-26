import { useEffect, useState } from 'react'

const BREAKPOINT = 768 // px

/**
 * Detects whether the app is running on a mobile-sized screen.
 * Uses a MediaQueryList so it reacts to orientation changes / window resize.
 */
export function usePlatform() {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < BREAKPOINT,
  )

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${BREAKPOINT - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return { isMobile }
}
