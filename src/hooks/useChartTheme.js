/**
 * useChartTheme — returns the live chart colours (see utils/chartTheme.js) and re-reads them
 * whenever the theme (class on <html>) or the brand colours (inline style on <html>) change.
 * Without this, a chart keeps the colours it had when it first rendered, so toggling
 * light/dark leaves stale grid lines and labels.
 */
import { useEffect, useState } from 'react'
import { readChartTheme } from '../utils/chartTheme'

export function useChartTheme() {
  const [theme, setTheme] = useState(readChartTheme)

  useEffect(() => {
    const refresh = () =>
      setTheme((prev) => {
        const next = readChartTheme()
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next
      })
    const observer = new MutationObserver(refresh)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })
    refresh()
    return () => observer.disconnect()
  }, [])

  return theme
}
