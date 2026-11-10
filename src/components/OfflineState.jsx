/**
 * OfflineState.jsx — page-level "you are offline" screen.
 *
 * Shown by ErrorBoundary when a page fails to load because the connection is
 * down (a lazy-loaded page chunk could not be fetched). It reloads by itself
 * the moment the browser reports the connection is back, and the Retry button
 * gives a manual route.
 *
 * Reloading (not just re-rendering) is deliberate: React.lazy caches a failed
 * import, so only a fresh page load fetches the chunk again.
 */
import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import StatusPage from './StatusPage'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

export default function OfflineState({ fullScreen = false }) {
  const online = useOnlineStatus()
  const [stillOffline, setStillOffline] = useState(false)

  // Connection came back by itself -> load the page again
  useEffect(() => {
    if (online) window.location.reload()
  }, [online])

  const retry = () => {
    if (navigator.onLine) window.location.reload()
    else setStillOffline(true)
  }

  return (
    <StatusPage
      fullScreen={fullScreen}
      tone="warning"
      icon={WifiOff}
      title="You are offline"
      message={
        stillOffline
          ? 'Still no connection. Check your Wi-Fi or mobile data, then try again.'
          : 'This page could not load because there is no internet connection. It will reload automatically once you are back online. Nothing you saved has been lost.'
      }
    >
      <button type="button" onClick={retry} className="btn btn-primary gap-1.5">
        <RefreshCw className="w-4 h-4" /> Try again
      </button>
    </StatusPage>
  )
}
