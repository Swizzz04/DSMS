/**
 * apiConfig.js — the single place the frontend learns where the backend lives.
 *
 * The URL comes from a Vite environment variable, so it differs per machine
 * and per deployment without touching code:
 *
 *   VITE_API_BASE_URL=https://localhost:7123/api
 *
 * Put it in `.env.local` (gitignored) — copy `.env.example` to start.
 * Vite only exposes variables that start with VITE_, and everything exposed
 * ends up readable in the browser, so NEVER put secrets here — only the URL.
 *
 * When VITE_API_BASE_URL is not set, IS_API_CONFIGURED is false and the app
 * keeps running on its local (offline) data exactly as before. That lets the
 * backend connection be switched on per developer without breaking anyone
 * else's copy.
 */

const RAW = (import.meta.env.VITE_API_BASE_URL || '').trim()

/** Base URL with any trailing slash removed, e.g. https://localhost:7123/api */
export const API_BASE_URL = RAW.replace(/\/+$/, '')

/** True only when a backend URL has been provided for this environment */
export const IS_API_CONFIGURED = API_BASE_URL !== ''

/** Build a full endpoint URL: apiUrl('/auth/login') → <base>/auth/login */
export function apiUrl(path = '') {
  if (!IS_API_CONFIGURED) {
    throw new Error('API is not configured — set VITE_API_BASE_URL in .env.local')
  }
  return `${API_BASE_URL}/${String(path).replace(/^\/+/, '')}`
}
