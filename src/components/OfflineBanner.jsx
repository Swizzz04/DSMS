/**
 * OfflineBanner.jsx — small status pill shown while the device is offline,
 * followed by a brief "Back online" confirmation. Mounted once in App.jsx so
 * it appears on every screen, including login. Sits at the bottom so it never
 * covers the header, and respects the phone's safe area.
 */
import { useEffect, useRef, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

const RECONNECT_FLASH_MS = 3000

export default function OfflineBanner() {
  const online = useOnlineStatus()
  const wasOffline = useRef(false)
  const [reconnected, setReconnected] = useState(false)

  useEffect(() => {
    if (!online) {
      wasOffline.current = true
      setReconnected(false)
      return undefined
    }
    if (!wasOffline.current) return undefined
    wasOffline.current = false
    setReconnected(true)
    const t = setTimeout(() => setReconnected(false), RECONNECT_FLASH_MS)
    return () => clearTimeout(t)
  }, [online])

  if (online && !reconnected) return null

  const isOffline = !online
  const Icon = isOffline ? WifiOff : Wifi

  return (
    <div
      className="fixed inset-x-3 sm:inset-x-auto sm:right-4 z-[90] flex justify-center pointer-events-none"
      style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div
        role="status"
        aria-live="polite"
        className="page-enter pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-lg"
        style={{
          backgroundColor: isOffline ? 'var(--color-warning-light)' : 'var(--color-success-light)',
          color: isOffline ? 'var(--color-warning-text)' : 'var(--color-success-text)',
          borderColor: isOffline ? 'var(--color-warning-border)' : 'var(--color-success-border)',
        }}
      >
        <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        {isOffline ? 'You are offline. Changes may not sync.' : 'Back online'}
      </div>
    </div>
  )
}
