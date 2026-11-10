/**
 * useOnlineStatus.js — true while the browser reports a network connection.
 *
 * Built on useSyncExternalStore so every component reads the same value and
 * re-renders on the browser's `online` / `offline` events. `navigator.onLine`
 * can say "online" on a dead Wi-Fi link, but it reliably says "offline" when
 * the device has no connection at all, which is the case this app cares about.
 */
import { useSyncExternalStore } from 'react'

function subscribe(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

const getSnapshot = () => navigator.onLine
const getServerSnapshot = () => true

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
