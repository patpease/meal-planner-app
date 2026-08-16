import { useEffect, useState } from 'react'

/** Keeps the screen awake while mounted (cooking mode). No-ops where the Wake Lock API isn't supported. */
export function useWakeLock() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    async function requestLock() {
      try {
        sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          await sentinel.release()
          return
        }
        setActive(true)
        sentinel.addEventListener('release', () => setActive(false))
      } catch {
        setActive(false)
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && !sentinel) requestLock()
    }

    requestLock()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      sentinel?.release()
    }
  }, [])

  return active
}
