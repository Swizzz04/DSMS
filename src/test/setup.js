/**
 * Test setup: an in-memory localStorage and a window that can receive events, so the bridges
 * (which read and write almirene_* keys and dispatch update events) run unchanged in Node.
 * Storage is emptied before every test, so no test depends on another.
 */
import { beforeEach } from 'vitest'

const store = new Map()

globalThis.localStorage = {
  getItem:    (k) => (store.has(k) ? store.get(k) : null),
  setItem:    (k, v) => { store.set(k, String(v)) },
  removeItem: (k) => { store.delete(k) },
  clear:      () => { store.clear() },
  key:        (i) => [...store.keys()][i] ?? null,
  get length() { return store.size },
}

globalThis.window = globalThis.window || {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
}

beforeEach(() => { store.clear() })
