/**
 * devTools.js — dev-only debugging helpers, never shipped to production.
 *
 * Problem this solves: localStorage holds a school's live config, but during
 * development that same localStorage silently overrides fixes shipped in
 * source code (e.g. a corrected users.js has no effect until the stale
 * cached almirene_app_config.systemUsers is cleared) — we hit this exact
 * issue ourselves multiple times this session. There's no in-app way to
 * reset back to source-code defaults without manually finding and clearing
 * keys in DevTools.
 *
 * exposeDevTools() is only called when import.meta.env.DEV is true (Vite's
 * built-in dev-server flag — always false in a production build), so this
 * can never reach a real client's browser.
 */

/**
 * Clears every localStorage key under the app's almirene_* namespace.
 * Prefix-based rather than an exhaustive hardcoded list — the app has 40+
 * almirene_* keys already (including per-user/per-campus prefixed ones like
 * almirene_theme_<id>), and a hardcoded list would just drift out of sync
 * the next time a feature adds a new key, same as the bug this exists to fix.
 * Returns the list of keys that were cleared, for visibility.
 */
export function resetAllToDefaults() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('almirene_'))
  keys.forEach(k => localStorage.removeItem(k))
  return keys
}

/**
 * Exposes window.almireneReset() in the browser console. Call it, then
 * refresh — the app rebuilds all config from source-code defaults, exactly
 * like a brand-new install. Only ever wired up in dev (see main.jsx).
 */
export function exposeDevTools() {
  window.almireneReset = () => {
    const cleared = resetAllToDefaults()
    console.log(`[ALMIRENE DX] Cleared ${cleared.length} localStorage key(s). Refresh to rebuild from source-code defaults.`, cleared)
    return cleared
  }
  console.log('%c[ALMIRENE DX dev tools] window.almireneReset() clears all local config back to source-code defaults.', 'color:#888')
}
